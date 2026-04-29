import { randomUUID } from "node:crypto";

import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  buildProductionLinkUrl,
  createProductionLinkToken,
  extractProductionLinkId,
  hashProductionLinkToken,
} from "@/lib/production-links";
import {
  getProductionReviewDecision,
  getReviewTimelineNote,
  PRODUCTION_EVENT_TYPES,
  type ProductionEventType,
  type ProductionReviewStatus,
} from "@/lib/production-review";
import { buildJobMediaStoragePath } from "@/lib/asset-storage-paths";
import { pushProductionEvidenceUpdate } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const PRODUCTION_LINK_TTL_DAYS = 90;
const SIGNED_ASSET_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;
const JOB_MEDIA_BUCKET = "job-media";

export type JobProductionLinkRow = {
  id: string;
  job_id: string;
  token_hash: string;
  status: "active" | "revoked";
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobMediaAssetRow = {
  id: string;
  event_id: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type JobMediaEventRow = {
  id: string;
  job_id: string;
  production_link_id: string;
  event_type: ProductionEventType;
  note: string | null;
  submitted_by_label: string | null;
  review_status: ProductionReviewStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_to_customer_at: string | null;
  created_at: string;
};

type ProductionTokenJobContext = {
  id: string;
  status: string;
  created_at: string;
  quotes?: {
    public_token?: string | null;
    leads?: {
      product_type?: string | null;
      customers?: {
        display_name?: string | null;
      } | null;
      conversation_id?: string | null;
    } | null;
  } | null;
} | null;

export type ResolvedProductionLink = {
  link: JobProductionLinkRow;
  job: ProductionTokenJobContext;
  token: string;
  url: string;
};

type ReviewAction = "approve" | "reject" | "send";

function addDays(days: number): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= Date.now();
}

function getProductionTokenSecret(): string {
  return (
    process.env.PRODUCTION_LINK_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ""
  );
}

function requireProductionTokenSecret(): string {
  const secret = getProductionTokenSecret();
  if (!secret) {
    throw new Error("Production link secret is not configured");
  }

  return secret;
}

function isValidEventType(value: string): value is ProductionEventType {
  return PRODUCTION_EVENT_TYPES.includes(value as ProductionEventType);
}

function assertUploadFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are allowed");
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_FILE_SIZE) {
    throw new Error("File size is invalid");
  }
}

export function getJobMediaBucketName(): string {
  return JOB_MEDIA_BUCKET;
}

export function getShareableProductionToken(linkId: string): string {
  return createProductionLinkToken({
    linkId,
    secret: requireProductionTokenSecret(),
  });
}

export async function buildShareableProductionLinkUrl(linkId: string): Promise<string> {
  const config = await getRuntimeAppConfig();
  return buildProductionLinkUrl(config.baseUrl, getShareableProductionToken(linkId));
}

export async function createOrReuseActiveProductionLink(
  supabase: AdminClient,
  jobId: string
): Promise<ResolvedProductionLink> {
  const runtimeConfig = await getRuntimeAppConfig();
  const { data: existingLinks, error: existingError } = await supabase
    .from("job_production_links")
    .select("id, job_id, token_hash, status, expires_at, last_used_at, created_at, updated_at")
    .eq("job_id", jobId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (existingError) {
    throw new Error(existingError.message);
  }

  const activeLink = (existingLinks || []).find((link) => !isExpired(link.expires_at));
  if (activeLink) {
    const token = getShareableProductionToken(activeLink.id);
    return {
      link: activeLink as JobProductionLinkRow,
      job: null,
      token,
      url: buildProductionLinkUrl(runtimeConfig.baseUrl, token),
    };
  }

  if ((existingLinks || []).length > 0) {
    await supabase
      .from("job_production_links")
      .update({ status: "revoked" })
      .eq("job_id", jobId)
      .eq("status", "active");
  }

  const linkId = randomUUID();
  const token = getShareableProductionToken(linkId);
  const { data: insertedLink, error: insertError } = await supabase
    .from("job_production_links")
    .insert({
      id: linkId,
      job_id: jobId,
      token_hash: hashProductionLinkToken(token),
      status: "active",
      expires_at: addDays(PRODUCTION_LINK_TTL_DAYS),
    })
    .select("id, job_id, token_hash, status, expires_at, last_used_at, created_at, updated_at")
    .single();

  if (insertError || !insertedLink) {
    throw new Error(insertError?.message || "Failed to create production link");
  }

  return {
    link: insertedLink as JobProductionLinkRow,
    job: null,
    token,
    url: buildProductionLinkUrl(runtimeConfig.baseUrl, token),
  };
}

export async function resolveProductionToken(
  supabase: AdminClient,
  token: string
): Promise<ResolvedProductionLink | null> {
  const linkId = extractProductionLinkId(token);
  if (!linkId) {
    return null;
  }

  const runtimeConfig = await getRuntimeAppConfig();
  const { data: row, error } = await supabase
    .from("job_production_links")
    .select(
      "id, job_id, token_hash, status, expires_at, last_used_at, created_at, updated_at, jobs(id, status, created_at, quotes(public_token, leads(product_type, conversation_id, customers(display_name))))"
    )
    .eq("id", linkId)
    .single();

  if (error || !row) {
    return null;
  }

  if (row.status !== "active" || isExpired(row.expires_at)) {
    return null;
  }

  if (row.token_hash !== hashProductionLinkToken(token)) {
    return null;
  }

  await supabase
    .from("job_production_links")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    link: {
      id: row.id,
      job_id: row.job_id,
      token_hash: row.token_hash,
      status: row.status,
      expires_at: row.expires_at,
      last_used_at: row.last_used_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    job: (Array.isArray(row.jobs) ? row.jobs[0] : row.jobs) as ProductionTokenJobContext,
    token,
    url: buildProductionLinkUrl(runtimeConfig.baseUrl, token),
  };
}

export async function createProductionSubmission(input: {
  supabase: AdminClient;
  token: string;
  eventType: string;
  note?: string;
  submittedByLabel?: string;
  files: File[];
}) {
  const runtimeConfig = await getRuntimeAppConfig();
  if (!runtimeConfig.productionUploadEnabled) {
    throw new Error("Production uploads are disabled");
  }

  if (!isValidEventType(input.eventType)) {
    throw new Error("Invalid production event type");
  }

  if (input.files.length === 0) {
    throw new Error("At least one image is required");
  }

  input.files.forEach(assertUploadFile);

  const resolvedLink = await resolveProductionToken(input.supabase, input.token);
  if (!resolvedLink) {
    throw new Error("Production link is invalid or expired");
  }

  const eventId = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = addDays(runtimeConfig.productionAssetRetentionDays);
  const note = input.note?.trim() || null;
  const submittedByLabel = input.submittedByLabel?.trim() || null;

  const { error: eventError } = await input.supabase.from("job_media_events").insert({
    id: eventId,
    job_id: resolvedLink.link.job_id,
    production_link_id: resolvedLink.link.id,
    event_type: input.eventType,
    note,
    submitted_by_label: submittedByLabel,
    review_status: "pending",
    created_at: createdAt,
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  const uploadedPaths: string[] = [];

  try {
    const assetRows: Array<Record<string, string | number | null>> = [];

    for (const file of input.files) {
      const storagePath = buildJobMediaStoragePath(
        resolvedLink.link.job_id,
        eventId,
        file.name || "upload.bin"
      );
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: uploadError } = await input.supabase.storage
        .from(JOB_MEDIA_BUCKET)
        .upload(storagePath, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      uploadedPaths.push(storagePath);
      assetRows.push({
        id: randomUUID(),
        event_id: eventId,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        width_px: null,
        height_px: null,
        expires_at: expiresAt,
        created_at: createdAt,
      });
    }

    const { error: assetInsertError } = await input.supabase
      .from("job_media_assets")
      .insert(assetRows);

    if (assetInsertError) {
      throw new Error(assetInsertError.message);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await input.supabase.storage.from(JOB_MEDIA_BUCKET).remove(uploadedPaths);
    }

    await input.supabase.from("job_media_assets").delete().eq("event_id", eventId);
    await input.supabase.from("job_media_events").delete().eq("id", eventId);
    throw error;
  }

  await input.supabase.from("job_timeline").insert({
    job_id: resolvedLink.link.job_id,
    status: resolvedLink.job?.status || "IN_PRODUCTION",
    note: getReviewTimelineNote({
      action: "submitted",
      eventType: input.eventType,
      assetCount: input.files.length,
    }),
    created_at: createdAt,
  });

  return {
    eventId,
    jobId: resolvedLink.link.job_id,
    reviewStatus: "pending" as const,
    assetCount: input.files.length,
  };
}

export async function signJobMediaAssetPaths(
  supabase: AdminClient,
  paths: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(JOB_MEDIA_BUCKET)
        .createSignedUrl(path, SIGNED_ASSET_URL_TTL_SECONDS);

      if (!error && data?.signedUrl) {
        results[path] = data.signedUrl;
      }
    })
  );

  return results;
}

export async function runProductionAssetCleanup(supabase: AdminClient) {
  const nowIso = new Date().toISOString();
  const { data: expiredAssets, error } = await supabase
    .from("job_media_assets")
    .select("id, storage_path")
    .is("deleted_at", null)
    .lte("expires_at", nowIso)
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const assets = expiredAssets || [];
  if (assets.length === 0) {
    return { deletedCount: 0 };
  }

  await supabase.storage
    .from(JOB_MEDIA_BUCKET)
    .remove(assets.map((asset) => asset.storage_path));

  const { error: markError } = await supabase
    .from("job_media_assets")
    .update({ deleted_at: nowIso })
    .in(
      "id",
      assets.map((asset) => asset.id)
    );

  if (markError) {
    throw new Error(markError.message);
  }

  return { deletedCount: assets.length };
}

export async function applyProductionReviewAction(input: {
  supabase: AdminClient;
  eventId: string;
  action: ReviewAction;
  reviewNote?: string;
  reviewedBy?: string;
}) {
  const runtimeConfig = await getRuntimeAppConfig();
  const { data: row, error } = await input.supabase
    .from("job_media_events")
    .select(
      "id, job_id, production_link_id, event_type, note, submitted_by_label, review_status, review_note, reviewed_by, reviewed_at, sent_to_customer_at, created_at, job_media_assets(id, storage_path), jobs(id, status, quotes(public_token, leads(conversation_id)))"
    )
    .eq("id", input.eventId)
    .single();

  if (error || !row) {
    throw new Error("Production event not found");
  }

  const currentStatus = row.review_status as ProductionReviewStatus;
  if (input.action === "approve" && ["rejected", "sent"].includes(currentStatus)) {
    throw new Error("This event can no longer be approved");
  }

  if (input.action === "reject" && currentStatus === "sent") {
    throw new Error("This event has already been sent");
  }

  if (input.action === "send" && currentStatus === "rejected") {
    throw new Error("Rejected events cannot be sent");
  }

  const { reviewStatusAfterReview, shouldSendToCustomer } =
    getProductionReviewDecision({
      action: input.action,
      customerAutoSendEnabled: runtimeConfig.productionCustomerAutoSendEnabled,
      currentReviewStatus: currentStatus,
    });
  const nowIso = new Date().toISOString();
  const reviewNote = input.reviewNote?.trim() || null;

  const updatePayload: Record<string, string | null> = {
    review_status: reviewStatusAfterReview,
    review_note: reviewNote,
    reviewed_by: input.reviewedBy || "admin",
    reviewed_at: nowIso,
  };

  const { error: updateError } = await input.supabase
    .from("job_media_events")
    .update(updatePayload)
    .eq("id", input.eventId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
  let finalStatus: ProductionReviewStatus = reviewStatusAfterReview;
  let notificationError: string | null = null;

  if (shouldSendToCustomer) {
    const quote = Array.isArray(job?.quotes) ? job?.quotes[0] : job?.quotes;
    const lead = Array.isArray(quote?.leads) ? quote?.leads[0] : quote?.leads;
    const conversationId = lead?.conversation_id;
    const quoteToken = quote?.public_token;

    try {
      if (!conversationId || !quoteToken) {
        throw new Error(
          "Review saved, but no customer status link is available for LINE notification"
        );
      }

      const { data: conversation, error: conversationError } = await input.supabase
        .from("conversations")
        .select("line_user_id")
        .eq("id", conversationId)
        .single();

      if (conversationError) {
        throw new Error(conversationError.message);
      }

      if (!conversation?.line_user_id) {
        throw new Error(
          "Review saved, but no LINE user is available for notification"
        );
      }

        const assetPaths = Array.isArray(row.job_media_assets)
          ? row.job_media_assets.map((asset) => asset.storage_path)
          : [];
        const signedUrls = await signJobMediaAssetPaths(input.supabase, assetPaths);

      await pushProductionEvidenceUpdate({
        userId: conversation.line_user_id,
        statusToken: quoteToken,
        eventType: row.event_type as ProductionEventType,
        note: row.note,
        assetUrls: assetPaths
          .map((path) => signedUrls[path])
          .filter((value): value is string => Boolean(value)),
      });

      const { error: markSentError } = await input.supabase
        .from("job_media_events")
        .update({
          review_status: "sent",
          sent_to_customer_at: nowIso,
        })
        .eq("id", input.eventId);

      if (markSentError) {
        throw new Error(
          `Customer was notified, but the event could not be marked as sent: ${markSentError.message}`
        );
      }

      finalStatus = "sent";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to notify customer via LINE";
      notificationError = `LINE notification failed. Event remains ${reviewStatusAfterReview}: ${message}`;
    }
  }

  const timelineAction =
    finalStatus === "sent"
      ? "sent"
      : finalStatus === "approved"
        ? "approved"
        : "rejected";

  await input.supabase.from("job_timeline").insert({
    job_id: row.job_id,
    status: job?.status || "IN_PRODUCTION",
    note: getReviewTimelineNote({
      action: timelineAction,
      eventType: row.event_type as ProductionEventType,
      assetCount: Array.isArray(row.job_media_assets) ? row.job_media_assets.length : 0,
    }),
    created_at: nowIso,
  });

  return {
    eventId: input.eventId,
    reviewStatus: finalStatus,
    notificationError: notificationError || undefined,
  };
}
