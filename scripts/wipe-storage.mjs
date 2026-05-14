#!/usr/bin/env node
/**
 * One-off storage wipe for the FOGUS test/dev environment.
 *
 * Empties every object in:
 *   - Cloudflare R2  `customer-media`  (private)
 *   - Cloudflare R2  `app-assets`      (public)
 *   - Supabase Storage `customer-media`
 *   - Supabase Storage `app-assets`
 *
 * The buckets themselves (and their public-access settings) are preserved.
 *
 * Reads credentials from `.env.local` already in the repo. Run with:
 *   node --env-file=.env.local scripts/wipe-storage.mjs
 */

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

function envOrFail(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

async function emptyR2Bucket(client, bucket) {
  let continuationToken;
  let deletedTotal = 0;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    const objects = list.Contents ?? [];

    if (objects.length > 0) {
      // S3-compatible DeleteObjects takes up to 1000 keys per call. R2 returns
      // <=1000 per page, so a single delete per page is fine.
      const { Deleted = [], Errors = [] } = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((object) => ({ Key: object.Key })),
            Quiet: true,
          },
        })
      );

      deletedTotal += Deleted.length || objects.length;

      if (Errors.length > 0) {
        console.warn(`  ⚠ ${Errors.length} delete errors in ${bucket}`);
        for (const err of Errors) {
          console.warn(`    - ${err.Key}: ${err.Code} ${err.Message}`);
        }
      }
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deletedTotal;
}

async function emptySupabaseBucket(supabase, bucket) {
  // Supabase Storage stores objects under nested paths. list() with the default
  // path returns top-level entries plus folder placeholders, so we walk the
  // tree breadth-first and accumulate every leaf path before deleting.
  const queue = [""];
  const allPaths = [];

  while (queue.length > 0) {
    const prefix = queue.shift();
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });

    if (error) {
      if (error.message?.includes("not found")) {
        return 0; // bucket doesn't exist on this project
      }
      throw error;
    }

    for (const entry of data ?? []) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folder placeholders have `id === null`. Real objects have an id.
      if (entry.id === null) {
        queue.push(fullPath);
      } else {
        allPaths.push(fullPath);
      }
    }
  }

  if (allPaths.length === 0) {
    return 0;
  }

  // remove() also takes up to 1000 keys per call.
  const chunkSize = 1000;
  let deleted = 0;
  for (let i = 0; i < allPaths.length; i += chunkSize) {
    const chunk = allPaths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      throw error;
    }
    deleted += chunk.length;
  }

  return deleted;
}

async function main() {
  const accessKeyId = envOrFail("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = envOrFail("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const endpoint = envOrFail("CLOUDFLARE_R2_ENDPOINT").replace(/\/+$/, "");
  const region = process.env.CLOUDFLARE_R2_REGION || "auto";
  const r2PrivateBucket =
    process.env.CLOUDFLARE_R2_BUCKET?.trim() || "customer-media";
  const r2PublicBucket =
    process.env.CLOUDFLARE_R2_PUBLIC_BUCKET?.trim() || "app-assets";

  const supabaseUrl = envOrFail("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = envOrFail("SUPABASE_SECRET_KEY");

  const r2 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const supabase = createClient(supabaseUrl, supabaseSecretKey);

  console.log("Wiping Cloudflare R2 buckets...");
  for (const bucket of [r2PrivateBucket, r2PublicBucket]) {
    try {
      const removed = await emptyR2Bucket(r2, bucket);
      console.log(`  ✓ R2 ${bucket}: removed ${removed} object(s)`);
    } catch (error) {
      console.error(`  ✗ R2 ${bucket}: ${error.message}`);
    }
  }

  console.log("Wiping Supabase Storage buckets...");
  for (const bucket of ["customer-media", "app-assets"]) {
    try {
      const removed = await emptySupabaseBucket(supabase, bucket);
      console.log(`  ✓ Supabase ${bucket}: removed ${removed} object(s)`);
    } catch (error) {
      console.error(`  ✗ Supabase ${bucket}: ${error.message}`);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("wipe-storage failed:", error);
  process.exit(1);
});
