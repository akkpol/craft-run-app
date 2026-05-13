import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CustomerMediaStorageProvider = "supabase" | "r2";

export type CustomerMediaAssetLocator = {
  storage_path: string;
  storage_provider?: CustomerMediaStorageProvider | null;
  storage_bucket?: string | null;
};

type NormalizedCustomerMediaAssetLocator = {
  storage_path: string;
  storage_provider: CustomerMediaStorageProvider;
  storage_bucket: string;
};

type CustomerMediaWriteResult = NormalizedCustomerMediaAssetLocator;

type R2Config = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

const DEFAULT_CUSTOMER_MEDIA_BUCKET = "customer-media";
const R2_REQUIRED_ENV_KEYS = [
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
] as const;

function getMissingR2ConfigKeys() {
  return R2_REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
}

function getR2Config(): R2Config | null {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKeyId,
    secretAccessKey,
    region: process.env.CLOUDFLARE_R2_REGION?.trim() || "auto",
  };
}

function createR2Client(config: R2Config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function normalizeLocator(
  asset: CustomerMediaAssetLocator
): NormalizedCustomerMediaAssetLocator {
  const provider = asset.storage_provider === "r2" ? "r2" : "supabase";
  const bucket = asset.storage_bucket?.trim() || DEFAULT_CUSTOMER_MEDIA_BUCKET;

  return {
    storage_path: asset.storage_path,
    storage_provider: provider,
    storage_bucket: bucket,
  };
}

export function getDefaultCustomerMediaBucket() {
  return DEFAULT_CUSTOMER_MEDIA_BUCKET;
}

export function isCustomerMediaR2Configured() {
  return getR2Config() !== null;
}

export function getCustomerMediaStorageRuntimeStatus() {
  const missingR2EnvKeys = getMissingR2ConfigKeys();
  const r2Configured = missingR2EnvKeys.length === 0;

  return {
    activeProvider: r2Configured ? "r2" : "supabase",
    r2Configured,
    requiredR2EnvKeys: [...R2_REQUIRED_ENV_KEYS],
    missingR2EnvKeys,
    fallbackProvider: "supabase",
  };
}

/**
 * Upload an object to R2 and return its **public** URL.
 *
 * Used for assets that must be publicly accessible without auth headers —
 * e.g. AI-generated design previews that are sent via LINE push messages.
 *
 * Requirements:
 * - R2 env vars must be configured (CLOUDFLARE_R2_BUCKET etc.)
 * - CLOUDFLARE_R2_PUBLIC_URL must be set to the bucket's public base URL
 *   (e.g. "https://pub-xxxx.r2.dev" from Cloudflare R2 dashboard › Public Access)
 * - The R2 bucket must have Public Access enabled in the Cloudflare dashboard
 *
 * Returns null if either condition is unmet → caller should fall back to Supabase.
 */
export async function uploadPublicObjectToR2({
  storagePath,
  bytes,
  contentType,
}: {
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string | null> {
  const r2Config = getR2Config();
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/+$/, "");

  if (!r2Config || !publicBaseUrl) {
    return null;
  }

  const client = createR2Client(r2Config);
  await client.send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: storagePath,
      Body: bytes,
      ContentType: contentType,
    })
  );

  return `${publicBaseUrl}/${storagePath}`;
}

export async function uploadCustomerMediaObject({
  supabase,
  storagePath,
  bytes,
  contentType,
}: {
  supabase: AdminClient;
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<CustomerMediaWriteResult> {
  const r2Config = getR2Config();

  if (r2Config) {
    const client = createR2Client(r2Config);
    await client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: storagePath,
        Body: bytes,
        ContentType: contentType,
      })
    );

    return {
      storage_path: storagePath,
      storage_provider: "r2",
      storage_bucket: r2Config.bucket,
    };
  }

  const { error } = await supabase.storage
    .from(DEFAULT_CUSTOMER_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storage_path: storagePath,
    storage_provider: "supabase",
    storage_bucket: DEFAULT_CUSTOMER_MEDIA_BUCKET,
  };
}

export async function removeCustomerMediaObjects({
  supabase,
  assets,
}: {
  supabase: AdminClient;
  assets: CustomerMediaAssetLocator[];
}) {
  const normalizedAssets = assets.map(normalizeLocator);
  const supabaseBuckets = new Map<string, string[]>();

  for (const asset of normalizedAssets) {
    if (asset.storage_provider === "supabase") {
      const existingPaths = supabaseBuckets.get(asset.storage_bucket) || [];
      existingPaths.push(asset.storage_path);
      supabaseBuckets.set(asset.storage_bucket, existingPaths);
    }
  }

  await Promise.all(
    Array.from(supabaseBuckets.entries()).map(async ([bucket, paths]) => {
      try {
        await supabase.storage.from(bucket).remove(paths);
      } catch {
        // Best-effort cleanup should not hide the original failure.
      }
    })
  );

  const r2Assets = normalizedAssets.filter(
    (asset) => asset.storage_provider === "r2"
  );

  if (r2Assets.length === 0) {
    return;
  }

  const r2Config = getR2Config();

  if (!r2Config) {
    return;
  }

  const client = createR2Client(r2Config);

  await Promise.allSettled(
    r2Assets.map((asset) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: asset.storage_bucket,
          Key: asset.storage_path,
        })
      )
    )
  );
}

export async function signCustomerMediaAssetLocators({
  supabase,
  assets,
  expiresIn,
}: {
  supabase: AdminClient;
  assets: CustomerMediaAssetLocator[];
  expiresIn: number;
}): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const normalizedAssets = assets.map(normalizeLocator);

  await Promise.all(
    normalizedAssets
      .filter((asset) => asset.storage_provider === "supabase")
      .map(async (asset) => {
        const { data, error } = await supabase.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, expiresIn);

        if (!error && data?.signedUrl) {
          results[asset.storage_path] = data.signedUrl;
        }
      })
  );

  const r2Assets = normalizedAssets.filter(
    (asset) => asset.storage_provider === "r2"
  );

  if (r2Assets.length === 0) {
    return results;
  }

  const r2Config = getR2Config();

  if (!r2Config) {
    return results;
  }

  const client = createR2Client(r2Config);

  await Promise.all(
    r2Assets.map(async (asset) => {
      try {
        results[asset.storage_path] = await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: asset.storage_bucket,
            Key: asset.storage_path,
          }),
          { expiresIn }
        );
      } catch {
        // Skip assets that cannot be signed.
      }
    })
  );

  return results;
}