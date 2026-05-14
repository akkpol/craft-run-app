import { NextRequest, NextResponse } from "next/server";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  normalizeLiffContextSnapshot,
  parseLiffContextSnapshot,
} from "@/lib/liff-capture";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVerifiedLiffAccessProfile,
  pushQuoteLink,
  verifyLiffIdToken,
} from "@/lib/line";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import {
  calculateProductCatalogPrice,
  findProductCatalogItem,
  resolveProductCatalogLabel,
} from "@/lib/product-catalog";
import { getProductCatalog } from "@/lib/product-catalog-store";
import {
  toMM,
  calculatePrice,
  getPrimaryDocumentRequestType,
  isBillingBranchType,
  isBillingEntityType,
  isDocumentRequestType,
  isFulfillmentMode,
  isPaymentTerm,
  normalizeDocumentRequestTypes,
} from "@/lib/types";
import type { IntakeFormData, WorkflowState } from "@/lib/types";
import { getLeadOperationalDefaults } from "@/lib/quote-workflow";
import {
  getReusableConversationState,
} from "@/lib/workflow-transitions";
import {
  uploadLeadMediaFiles,
  validateCustomerMediaFiles,
} from "@/lib/customer-media";
import {
  getConversationsToCancelForFreshRestart,
  getLeadsToSupersedeForFreshRestart,
  type FreshRestartConversationCandidate,
  type FreshRestartConversationReplacement,
  type FreshRestartLeadCandidate,
} from "@/lib/customer-restart";
import { logSystemAction } from "@/lib/action-log";
import {
  buildLeadPromptFields,
  parseMultipartIntakeFormData,
  parseOptionalNumber,
} from "@/lib/intake-payload";
import {
  buildLiffValidationTestNote,
  LIFF_VALIDATION_MODE,
} from "@/lib/liff-validation";
import {
  formatTaxDocumentIntakeErrors,
  validateTaxDocumentIntake,
} from "@/lib/tax-document-intake";

const THAI_SUMMARY_NUMBER_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn");

function getBangkokTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  let data: IntakeFormData;
  let customerMediaFiles: File[] = [];

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      ({ data, customerMediaFiles } = parseMultipartIntakeFormData(
        await request.formData()
      ));
    } else {
      data = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "Invalid intake request" }, { status: 400 });
  }

  const providedLiffIdToken = data.liffIdToken?.trim() || "";
  const liffDebugFingerprint =
    request.headers.get("x-liff-debug-fingerprint")?.trim() || null;
  const earliestDueDate = getBangkokTodayDateString();

  // Simple required-field validation
  const errors: string[] = [];
  if (!data.productType) errors.push("productType is required");
  if (!data.width || data.width <= 0) errors.push("width must be positive");
  if (!data.height || data.height <= 0) errors.push("height must be positive");
  if (!data.unit) errors.push("unit is required");
  if (!data.qty || data.qty <= 0) errors.push("qty must be positive");
  if (!data.phone) errors.push("phone is required");
  if (data.paymentTerms && !isPaymentTerm(data.paymentTerms)) {
    errors.push("paymentTerms is invalid");
  }
  if (!data.fulfillmentMode || !isFulfillmentMode(data.fulfillmentMode)) {
    errors.push("fulfillmentMode is required");
  }
  if (data.billingEntityType && !isBillingEntityType(data.billingEntityType)) {
    errors.push("billingEntityType is invalid");
  }
  if (data.requestedDocumentType && !isDocumentRequestType(data.requestedDocumentType)) {
    errors.push("requestedDocumentType is invalid");
  }
  if (
    data.requestedDocumentTypes !== undefined &&
    !Array.isArray(data.requestedDocumentTypes)
  ) {
    errors.push("requestedDocumentTypes must be an array");
  } else if (
    data.requestedDocumentTypes?.some(
      (type) => !isDocumentRequestType(type)
    )
  ) {
    errors.push("requestedDocumentTypes is invalid");
  }
  if (data.intakeMode && !["resume", "fresh"].includes(data.intakeMode)) {
    errors.push("intakeMode is invalid");
  }
  if (data.validationMode && data.validationMode !== LIFF_VALIDATION_MODE) {
    errors.push("validationMode is invalid");
  }
  if (data.dueDate && data.dueDate < earliestDueDate) {
    errors.push("dueDate must be today or later");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
  }

  try {
    validateCustomerMediaFiles(customerMediaFiles);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไฟล์อ้างอิงไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  const providedDevLineUserId =
    process.env.NODE_ENV !== "production"
      ? request.nextUrl.searchParams.get("devLineUserId")?.trim() || ""
      : "";

  let intakeIdentity: Awaited<ReturnType<typeof verifyLiffIdToken>>;
  if (providedLiffIdToken) {
    try {
      intakeIdentity = await verifyLiffIdToken(providedLiffIdToken);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify LIFF identity";
      await logSystemAction(createAdminClient(), {
        entityType: "system",
        actionType: "liff.intake_issue",
        serviceName: "intake",
        note: "LIFF intake identity verification failed",
        payload: {
          fingerprint: liffDebugFingerprint,
          stage: "intake_verify_token_failed",
          message,
          intakeMode: data.intakeMode || null,
          hasLiffIdToken: true,
          hasLiffContextSnapshot: Boolean(data.liffContextSnapshot),
          userAgent: request.headers.get("user-agent"),
        },
      });
      return NextResponse.json(
        { error: `Unable to verify LINE identity: ${message}` },
        { status: 400 }
      );
    }
  } else if (providedDevLineUserId) {
    intakeIdentity = {
      userId: providedDevLineUserId,
      displayName: "Dev Test User",
    } as Awaited<ReturnType<typeof verifyLiffIdToken>>;
  } else {
    return NextResponse.json(
      {
        error:
          "LINE identity verification is required. Please reopen the form from LINE.",
      },
      { status: 400 }
    );
  }

  const resolvedLineUserId = intakeIdentity.userId;
  const resolvedDisplayName =
    intakeIdentity.displayName?.trim() ||
    "ลูกค้า";
  const billingEntityType =
    data.billingEntityType && isBillingEntityType(data.billingEntityType)
      ? data.billingEntityType
      : "person";
  const normalizedBillingBranchType =
    data.billingBranchType && isBillingBranchType(data.billingBranchType)
      ? data.billingBranchType
      : "head_office";
  const billingBranchType =
    billingEntityType === "company" ? normalizedBillingBranchType : null;
  const billingBranchCode =
    billingEntityType === "company" && normalizedBillingBranchType === "branch"
      ? data.billingBranchCode?.trim() || null
      : null;
  const requestedDocumentTypes = normalizeDocumentRequestTypes(
    data.requestedDocumentTypes?.length
      ? data.requestedDocumentTypes
      : data.requestedDocumentType
  );
  const requestedDocumentType = getPrimaryDocumentRequestType(
    requestedDocumentTypes
  );
  const fulfillmentMode =
    data.fulfillmentMode && isFulfillmentMode(data.fulfillmentMode)
      ? data.fulfillmentMode
      : null;
  const billingName = data.billingName?.trim() || null;
  const taxId = data.taxId?.trim() || null;
  const billingAddress = data.billingAddress?.trim() || null;
  const fulfillmentAddressLine1 = data.fulfillmentAddressLine1?.trim() || null;
  const fulfillmentAddressLine2 = data.fulfillmentAddressLine2?.trim() || null;
  const fulfillmentSubdistrict = data.fulfillmentSubdistrict?.trim() || null;
  const fulfillmentDistrict = data.fulfillmentDistrict?.trim() || null;
  const fulfillmentProvince = data.fulfillmentProvince?.trim() || null;
  const fulfillmentPostalCode = data.fulfillmentPostalCode?.trim() || null;
  const fulfillmentLatitude = parseOptionalNumber(data.fulfillmentLatitude);
  const fulfillmentLongitude = parseOptionalNumber(data.fulfillmentLongitude);
  const requiresFulfillmentAddress =
    fulfillmentMode === "delivery" || fulfillmentMode === "install";

  if (
    requiresFulfillmentAddress &&
    (!fulfillmentAddressLine1 ||
      !fulfillmentDistrict ||
      !fulfillmentProvince ||
      !fulfillmentPostalCode)
  ) {
    return NextResponse.json(
      {
        error:
          "กรุณาระบุที่อยู่จัดส่งหรือติดตั้งให้ครบอย่างน้อย บ้านเลขที่/ถนน เขตหรืออำเภอ จังหวัด และรหัสไปรษณีย์",
      },
      { status: 400 }
    );
  }

  if (
    typeof fulfillmentLatitude === "number" &&
    (Number.isNaN(fulfillmentLatitude) ||
      fulfillmentLatitude < -90 ||
      fulfillmentLatitude > 90)
  ) {
    return NextResponse.json(
      { error: "latitude ต้องอยู่ระหว่าง -90 ถึง 90" },
      { status: 400 }
    );
  }

  if (
    typeof fulfillmentLongitude === "number" &&
    (Number.isNaN(fulfillmentLongitude) ||
      fulfillmentLongitude < -180 ||
      fulfillmentLongitude > 180)
  ) {
    return NextResponse.json(
      { error: "longitude ต้องอยู่ระหว่าง -180 ถึง 180" },
      { status: 400 }
    );
  }

  if (
    (typeof fulfillmentLatitude === "number" && fulfillmentLongitude === null) ||
    (typeof fulfillmentLongitude === "number" && fulfillmentLatitude === null)
  ) {
    return NextResponse.json(
      { error: "กรุณาระบุ latitude และ longitude ให้ครบทั้งคู่" },
      { status: 400 }
    );
  }

  const taxDocumentValidation = validateTaxDocumentIntake({
    requestedDocumentType,
    requestedDocumentTypes,
    billingEntityType,
    billingBranchType,
    billingBranchCode,
    billingName,
    taxId,
    billingAddress,
  });

  if (taxDocumentValidation.errors.length > 0) {
    return NextResponse.json(
      { error: formatTaxDocumentIntakeErrors(taxDocumentValidation.errors) },
      { status: 400 }
    );
  }
  const liffContextSnapshot =
    typeof data.liffContextSnapshot === "string"
      ? parseLiffContextSnapshot(data.liffContextSnapshot)
      : normalizeLiffContextSnapshot(data.liffContextSnapshot);

  let verifiedAccessProfile: Awaited<
    ReturnType<typeof getVerifiedLiffAccessProfile>
  > | null = null;

  if (data.liffAccessToken?.trim()) {
    try {
      verifiedAccessProfile = await getVerifiedLiffAccessProfile(
        data.liffAccessToken,
        resolvedLineUserId
      );
    } catch (error) {
      console.warn("Unable to enrich LIFF access profile:", error);
      await logSystemAction(createAdminClient(), {
        entityType: "system",
        actionType: "liff.intake_issue",
        serviceName: "intake",
        note: "LIFF access profile enrichment failed",
        payload: {
          fingerprint: liffDebugFingerprint,
          stage: "intake_access_profile_failed",
          message: error instanceof Error ? error.message : String(error),
          intakeMode: data.intakeMode || null,
          lineUserId: resolvedLineUserId,
        },
      });
    }
  }

  const liffProfileSnapshot = {
    collectedAt: new Date().toISOString(),
    userId: resolvedLineUserId,
    displayName:
      verifiedAccessProfile?.displayName || intakeIdentity.displayName || null,
    pictureUrl:
      verifiedAccessProfile?.pictureUrl || intakeIdentity.pictureUrl || null,
    email: intakeIdentity.email || null,
    statusMessage: verifiedAccessProfile?.statusMessage || null,
    friendshipStatus: verifiedAccessProfile?.friendshipStatus ?? null,
    authTime: intakeIdentity.authTime,
    amr: intakeIdentity.amr,
    accessTokenVerification: verifiedAccessProfile
      ? {
          scope: verifiedAccessProfile.scope,
          expiresIn: verifiedAccessProfile.expiresIn,
        }
      : null,
  };

  const supabase = createAdminClient();

  // Normalize units to mm
  const widthMm = toMM(data.width, data.unit);
  const heightMm = toMM(data.height, data.unit);
  const qty = data.qty;
  const { items: runtimeProductCatalog } = await getProductCatalog({
    activeOnly: false,
  });
  const selectedProduct = findProductCatalogItem(
    runtimeProductCatalog,
    data.productType
  );
  const productLabel = resolveProductCatalogLabel({
    productType: data.productType,
    productLabelSnapshot: selectedProduct?.label || null,
  });

  // 1. Upsert customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        line_user_id: resolvedLineUserId,
        display_name: resolvedDisplayName,
        phone: data.phone,
        line_email: intakeIdentity.email || undefined,
        line_picture_url:
          verifiedAccessProfile?.pictureUrl || intakeIdentity.pictureUrl || undefined,
        line_status_message: verifiedAccessProfile?.statusMessage || undefined,
        line_friendship_status:
          typeof verifiedAccessProfile?.friendshipStatus === "boolean"
            ? verifiedAccessProfile.friendshipStatus
            : undefined,
        last_liff_profile: liffProfileSnapshot,
        last_liff_context: liffContextSnapshot || undefined,
      },
      { onConflict: "line_user_id" }
    )
    .select("id")
    .single();

  if (!customer) {
    return NextResponse.json(
      { error: `Failed to create customer${customerError ? `: ${customerError.message}` : ""}` },
      { status: 500 }
    );
  }

  // 2. Find or create conversation
  let conversationId: string;
  let conversationState: WorkflowState = "NEW_MESSAGE";
  const { data: existingConvRows, error: existingConvError } = await supabase
    .from("conversations")
    .select("id, state")
    .eq("line_user_id", resolvedLineUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingConvError) {
    return NextResponse.json(
      { error: `Failed to load conversation: ${existingConvError.message}` },
      { status: 500 }
    );
  }

  const existingConv = existingConvRows?.[0] ?? null;
  const forceFreshConversation = data.intakeMode === "fresh";
  const reusableConversationState = getReusableConversationState(
    existingConv?.state,
    "REQUIREMENTS_REVIEW"
  );
  const shouldReuseConversation = Boolean(
    !forceFreshConversation && existingConv && reusableConversationState
  );

  if (existingConv && reusableConversationState && !forceFreshConversation) {
    conversationId = existingConv.id;
    conversationState = reusableConversationState;

    if (reusableConversationState !== existingConv.state) {
      const { error: normalizeConversationError } = await supabase
        .from("conversations")
        .update({ state: reusableConversationState })
        .eq("id", conversationId);

      if (normalizeConversationError) {
        return NextResponse.json(
          {
            error: `Failed to normalize conversation state: ${normalizeConversationError.message}`,
          },
          { status: 500 }
        );
      }
    }
  } else {
    const { data: newConv, error: newConvError } = await supabase
      .from("conversations")
      .insert({ line_user_id: resolvedLineUserId, state: "REQUIREMENTS_REVIEW" })
      .select("id")
      .single();

    if (!newConv?.id) {
      return NextResponse.json(
        {
          error: `Failed to create conversation${newConvError ? `: ${newConvError.message}` : ""}`,
        },
        { status: 500 }
      );
    }

    conversationId = newConv.id;
    conversationState = "REQUIREMENTS_REVIEW";
  }

  // 3. Update conversation state
  if (shouldReuseConversation && conversationState !== "REQUIREMENTS_REVIEW") {
    const { error: updateConversationError } = await supabase
      .from("conversations")
      .update({ state: "REQUIREMENTS_REVIEW" })
      .eq("id", conversationId);

    if (updateConversationError) {
      return NextResponse.json(
        {
          error: `Failed to update conversation: ${updateConversationError.message}`,
        },
        { status: 500 }
      );
    }
  }

  // 3.5. Fresh restart: supersede prior leads and cancel prior conversations
  // BEFORE creating the new lead, so mid-flight failures cannot leave duplicate active leads.
  let freshRestartLeadsToSupersede: FreshRestartLeadCandidate[] = [];
  let freshRestartConversationsToCancel: FreshRestartConversationReplacement[] = [];
  if (forceFreshConversation) {
    const { data: priorConversationRows, error: priorConversationError } =
      await supabase
        .from("conversations")
        .select("id, state")
        .eq("line_user_id", resolvedLineUserId)
        .neq("id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);

    if (priorConversationError) {
      return NextResponse.json(
        {
          error: `Failed to load prior conversations: ${priorConversationError.message}`,
        },
        { status: 500 }
      );
    }

    // Lead does not exist yet — no .neq("id", ...) filter needed; pass "" as sentinel
    const { data: priorLeadRows, error: priorLeadError } = await supabase
      .from("leads")
      .select(
        "id, conversation_id, status, superseded_at, quotes(id, status, jobs(id, status)), conversations!inner(line_user_id)"
      )
      .eq("conversations.line_user_id", resolvedLineUserId)
      .is("superseded_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (priorLeadError) {
      return NextResponse.json(
        { error: `Failed to load prior leads: ${priorLeadError.message}` },
        { status: 500 }
      );
    }

    freshRestartConversationsToCancel = getConversationsToCancelForFreshRestart(
      (priorConversationRows || []) as FreshRestartConversationCandidate[],
      conversationId
    );
    // Pass "" as sentinel replacementLeadId — lead.id is not known yet
    freshRestartLeadsToSupersede = getLeadsToSupersedeForFreshRestart(
      (priorLeadRows || []) as FreshRestartLeadCandidate[],
      ""
    );

    const supersededAt = new Date().toISOString();

    // Supersede prior leads first. superseded_by_lead_id will be back-filled after lead creation.
    for (const priorLead of freshRestartLeadsToSupersede) {
      const { error: supersedeLeadError } = await supabase
        .from("leads")
        .update({
          status: "superseded",
          superseded_at: supersededAt,
          supersede_reason: "Customer started a fresh request in LINE",
        })
        .eq("id", priorLead.id);

      if (supersedeLeadError) {
        return NextResponse.json(
          { error: `Failed to supersede previous lead: ${supersedeLeadError.message}` },
          { status: 500 }
        );
      }
    }

    // Cancel prior conversations
    for (const priorConversation of freshRestartConversationsToCancel) {
      const { error: cancelConversationError } = await supabase
        .from("conversations")
        .update({ state: "CANCELLED" })
        .eq("id", priorConversation.id);

      if (cancelConversationError) {
        return NextResponse.json(
          {
            error: `Failed to cancel previous conversation: ${cancelConversationError.message}`,
          },
          { status: 500 }
        );
      }
    }
  }

  // 4. Create lead
  const needsReview =
    !data.productType || !data.dueDate || widthMm <= 0 || heightMm <= 0;
  const holdReason = needsReview
    ? "ยังมีข้อมูลไม่ครบสำหรับออกใบเสนอราคาอัตโนมัติ"
    : null;
  const leadDefaults = getLeadOperationalDefaults(fulfillmentMode);
  const isValidationHarness = data.validationMode === LIFF_VALIDATION_MODE;
  const validationRunLabel = new Date().toISOString();
  const leadPromptInput = isValidationHarness
    ? {
        ...data,
        note: [data.note, buildLiffValidationTestNote(validationRunLabel)]
          .filter(Boolean)
          .join("\n"),
        referenceInfo: [
          data.referenceInfo,
          "Harness source: /liff/validation-harness",
        ]
          .filter(Boolean)
          .join("\n"),
        designBrief: [
          data.designBrief,
          "System-generated LIFF validation test payload.",
        ]
          .filter(Boolean)
          .join("\n"),
      }
    : data;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      conversation_id: conversationId,
      customer_id: customer.id,
      product_type: data.productType,
      product_label_snapshot: productLabel,
      product_category_snapshot: selectedProduct?.category || null,
      product_category_label_snapshot: selectedProduct?.categoryLabel || null,
      width_mm: widthMm,
      height_mm: heightMm,
      qty,
      due_date: data.dueDate || null,
      ...buildLeadPromptFields(leadPromptInput),
      requested_document_type: requestedDocumentType,
      requested_document_types: requestedDocumentTypes,
      billing_entity_type: billingEntityType,
      billing_branch_type: billingBranchType,
      billing_branch_code: billingBranchCode,
      billing_name: billingName,
      tax_id: taxId,
      billing_address: billingAddress,
      fulfillment_address_line1: requiresFulfillmentAddress
        ? fulfillmentAddressLine1
        : null,
      fulfillment_address_line2: requiresFulfillmentAddress
        ? fulfillmentAddressLine2
        : null,
      fulfillment_subdistrict: requiresFulfillmentAddress
        ? fulfillmentSubdistrict
        : null,
      fulfillment_district: requiresFulfillmentAddress
        ? fulfillmentDistrict
        : null,
      fulfillment_province: requiresFulfillmentAddress
        ? fulfillmentProvince
        : null,
      fulfillment_postal_code: requiresFulfillmentAddress
        ? fulfillmentPostalCode
        : null,
      fulfillment_latitude: requiresFulfillmentAddress
        ? fulfillmentLatitude
        : null,
      fulfillment_longitude: requiresFulfillmentAddress
        ? fulfillmentLongitude
        : null,
      liff_profile_snapshot: liffProfileSnapshot,
      liff_context_snapshot: liffContextSnapshot || null,
      fulfillment_mode: leadDefaults.fulfillment_mode,
      design_assignment_mode: leadDefaults.design_assignment_mode,
      design_executor: leadDefaults.design_executor,
      design_status: leadDefaults.design_status,
      hold_reason: holdReason,
      status: needsReview ? "new" : "quoted",
    })
    .select("id")
    .single();

  if (!lead) {
    return NextResponse.json(
      { error: `Failed to create lead${leadError ? `: ${leadError.message}` : ""}` },
      { status: 500 }
    );
  }

  let referenceUploadWarning: string | null = null;
  if (customerMediaFiles.length > 0) {
    try {
      await uploadLeadMediaFiles({
        supabase,
        leadId: lead.id,
        files: customerMediaFiles,
      });
    } catch (error) {
      // Media upload failed after lead creation - log but don't rollback lead
      // to avoid orphaned leads on retry. The lead will be visible in admin
      // and can be manually processed.
      console.error(`Media upload failed for lead ${lead.id}:`, error);

      // Keep the lead/quote flow intact, but tell the client the attachments
      // were not stored so the customer can follow up without retrying intake.
      const mediaError = error instanceof Error ? error.message : "Unknown upload error";
      console.warn(`Lead ${lead.id} created successfully but media upload failed: ${mediaError}`);
      referenceUploadWarning =
        "เราได้รับรายละเอียดงานแล้ว แต่ไฟล์อ้างอิงยังอัปโหลดไม่สำเร็จ กรุณาส่งไฟล์กลับมาใน LINE หรือแนบลิงก์ไฟล์อีกครั้งเพื่อให้ทีมงานตรวจสอบได้ครบถ้วน";
    }
  }

  // 4.5. Fresh restart: back-fill superseded_by_lead_id and emit audit logs now that lead.id is known
  if (
    forceFreshConversation &&
    (freshRestartLeadsToSupersede.length > 0 || freshRestartConversationsToCancel.length > 0)
  ) {
    const supersedeNote = `Superseded by fresh intake lead ${lead.id}`;

    for (const priorLead of freshRestartLeadsToSupersede) {
      await supabase
        .from("leads")
        .update({ superseded_by_lead_id: lead.id })
        .eq("id", priorLead.id);

      await logSystemAction(supabase, {
        entityType: "lead",
        entityId: priorLead.id,
        actionType: "lead.superseded",
        serviceName: "intake",
        note: supersedeNote,
        payload: {
          superseded_by_lead_id: lead.id,
          replacement_conversation_id: conversationId,
          replacement_mode: "fresh",
        },
      });
    }

    for (const priorConversation of freshRestartConversationsToCancel) {
      await logSystemAction(supabase, {
        entityType: "conversation",
        entityId: priorConversation.id,
        actionType: "conversation.state_changed",
        serviceName: "intake",
        note: supersedeNote,
        payload: {
          from: priorConversation.fromState,
          to: "CANCELLED",
          replacement_lead_id: lead.id,
          replacement_mode: "fresh",
        },
      });
    }
  }

  // 5. If data incomplete, park the conversation until the customer adds more info
  if (needsReview) {
    await supabase
      .from("conversations")
      .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
      .eq("id", conversationId);

    await logSystemAction(supabase, {
      entityType: "lead",
      entityId: lead.id,
      actionType: "lead.created",
      serviceName: "intake",
      note: "Lead created — incomplete data, waiting for customer input",
      payload: {
        conversation_id: conversationId,
        state: "ON_HOLD_CUSTOMER_INPUT",
        needs_review: true,
        intake_mode: data.intakeMode ?? "resume",
      },
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      needsReview: true,
      message: "Lead created — waiting for more customer input",
      referenceUploadFailed: Boolean(referenceUploadWarning),
      referenceUploadWarning,
    });
  }

  // 6. Calculate price & create quote
  const subtotal = selectedProduct
    ? calculateProductCatalogPrice(selectedProduct, widthMm, heightMm, qty)
    : calculatePrice(data.productType, widthMm, heightMm, qty);
  const vat = Math.round(subtotal * 0.07 * 100) / 100;
  const total = subtotal + vat;
  const paymentTerms = data.paymentTerms || "prepaid";
  const appConfig = await getRuntimeAppConfig();
  const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
    total,
    billingEntityType,
    paymentTerms,
  });

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: lead.id,
      subtotal,
      discount: 0,
      vat,
      total,
      status: "sent",
      payment_terms: paymentTerms,
      payment_status: paymentTerms === "credit" ? "not_required" : "unpaid",
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .select("id, public_token")
    .single();

  if (!quote) {
    return NextResponse.json(
      { error: `Failed to create quote${quoteError ? `: ${quoteError.message}` : ""}` },
      { status: 500 }
    );
  }

  // 7. Create quote items
  await supabase.from("quote_items").insert({
    quote_id: quote.id,
    label: `${productLabel} (${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)} ซม.) × ${qty}`,
    qty: 1,
    unit_price: subtotal,
  });

  // 8. Move the conversation into the customer approval stage
  await supabase
    .from("conversations")
    .update({ state: "WAITING_QUOTE_APPROVAL" })
    .eq("id", conversationId);

  await logSystemAction(supabase, {
    entityType: "lead",
    entityId: lead.id,
    actionType: "lead.created",
    serviceName: "intake",
    payload: {
      conversation_id: conversationId,
      product_type: data.productType,
      intake_mode: data.intakeMode ?? "resume",
      validation_mode: data.validationMode ?? null,
    },
  });
  await logSystemAction(supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.created",
    serviceName: "intake",
    payload: {
      lead_id: lead.id,
      total,
      payment_terms: paymentTerms,
      to_state: "WAITING_QUOTE_APPROVAL",
      intake_mode: data.intakeMode ?? "resume",
      validation_mode: data.validationMode ?? null,
    },
  });

  // 9. Send quote link to customer via LINE push
  try {
    const summary = `${productLabel} ${(widthMm / 10).toFixed(0)}×${(heightMm / 10).toFixed(0)} ซม. จำนวน ${qty} ชิ้น\nราคารวม VAT: ฿${THAI_SUMMARY_NUMBER_FORMATTER.format(total)}`;
    await pushQuoteLink(resolvedLineUserId, quote.public_token, summary);
    await logSystemAction(supabase, {
      entityType: "quote",
      entityId: quote.id,
      actionType: "quote.sent",
      serviceName: "line_push",
      note: "Delivered quote link to customer",
      payload: {
        lead_id: lead.id,
        line_user_id: resolvedLineUserId,
        quote_token: quote.public_token,
      },
    });
  } catch (error) {
    console.error("Failed to push quote link:", error);
    // Don't fail — quote is created, customer can still access via admin
  }

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    quoteId: quote.id,
    quoteToken: quote.public_token,
    total,
    referenceUploadFailed: Boolean(referenceUploadWarning),
    referenceUploadWarning,
  });
}
