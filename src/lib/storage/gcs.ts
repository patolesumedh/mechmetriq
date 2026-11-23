import "server-only";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { PubSub } from "@google-cloud/pubsub";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkUploadRateLimit } from "@/lib/security/rateLimit";
import type { Database } from "@/lib/types/database";

/**
 * GCS Keyless V4 Signed URLs + Ownership Enforcement + Pub/Sub CAD Job Publisher.
 *
 * IMPORTANT:
 * - Vendor KYC documents stay in Supabase Storage (`KYC_DOCS_BUCKET`) under RLS.
 * - Only CAD attachments (`uploads/...`) and worker outputs (`derived/...`) use GCS.
 * - Dual-mode support: when `GCS_CAD_BUCKET` is unset (local dev without GCP),
 *   callers transparently fall back to the `rfq-attachments` Supabase Storage bucket.
 */

export const MAX_CAD_FILE_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes (50 MB)
const LEGACY_SUPABASE_BUCKET = "rfq-attachments";

export const ALLOWED_CAD_CONTENT_TYPES: Record<string, string> = {
  ".step": "application/step",
  ".stp": "application/step",
  ".iges": "model/iges",
  ".igs": "model/iges",
  ".stl": "model/stl",
  ".pdf": "application/pdf",
  ".dwg": "image/vnd.dwg",
  ".dxf": "image/vnd.dxf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

let storageClient: Storage | null = null;
let pubsubClient: PubSub | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function getPubSub(): PubSub {
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }
  return pubsubClient;
}

export function isGcsCadEnabled(): boolean {
  return Boolean(process.env.GCS_CAD_BUCKET);
}

export function isGcsObjectPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return (
    path.startsWith("uploads/") ||
    path.startsWith("derived/") ||
    path.startsWith("orders/")
  );
}

export function normalizeCadExtension(fileName: string): { ext: string; contentType: string } | null {
  const lower = fileName.trim().toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = lower.slice(dot);
  const contentType = ALLOWED_CAD_CONTENT_TYPES[ext];
  if (!contentType) return null;
  const canonicalExt = ext === ".jpeg" ? ".jpg" : ext;
  return { ext: canonicalExt, contentType };
}

export interface SignedCadUploadResult {
  mode: "gcs" | "supabase";
  uploadUrl?: string;
  objectPath: string;
  contentType: string;
  requiredHeaders?: Record<string, string>;
  error?: string;
}

/**
 * Issues a 15-minute V4 PUT signed URL for an authenticated user.
 * - Enforces Upstash rate limits (30/hr per user, 60/hr per IP).
 * - Generates a server-controlled path: `uploads/{user_id}/{uuid}.{ext}`.
 * - Locks exact `Content-Type` and `x-goog-content-length-range: 1,52428800`.
 */
export async function issueCadUploadSignedUrl(params: {
  userId: string;
  fileName: string;
  fileSize: number;
}): Promise<SignedCadUploadResult> {
  const { userId, fileName, fileSize } = params;

  const rl = await checkUploadRateLimit(userId);
  if (!rl.allowed) {
    return { mode: "gcs", objectPath: "", contentType: "", error: rl.error };
  }

  const extInfo = normalizeCadExtension(fileName);
  if (!extInfo) {
    return {
      mode: "gcs",
      objectPath: "",
      contentType: "",
      error: "Unsupported file extension. Allowed: .step, .stp, .iges, .igs, .stl, .pdf, .dwg, .dxf, .png, .jpg.",
    };
  }

  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_CAD_FILE_BYTES) {
    return {
      mode: "gcs",
      objectPath: "",
      contentType: "",
      error: "File size must be between 1 byte and 50 MB.",
    };
  }

  const bucketName = process.env.GCS_CAD_BUCKET;
  if (!bucketName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    return {
      mode: "supabase",
      objectPath: `${userId}/${Date.now()}-${safeName}`,
      contentType: extInfo.contentType,
    };
  }

  const objectPath = `uploads/${userId}/${randomUUID()}${extInfo.ext}`;
  const extensionHeaders: Record<string, string> = {
    "x-goog-content-length-range": `1,${MAX_CAD_FILE_BYTES}`,
  };

  const [uploadUrl] = await getStorage()
    .bucket(bucketName)
    .file(objectPath)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: extInfo.contentType,
      extensionHeaders,
    });

  return {
    mode: "gcs",
    uploadUrl,
    objectPath,
    contentType: extInfo.contentType,
    requiredHeaders: {
      "Content-Type": extInfo.contentType,
      ...extensionHeaders,
    },
  };
}

/**
 * Verifies that a storage path belongs to `userId` and is free of path traversal.
 */
export function isOwnedCadPath(userId: string, path: string): boolean {
  if (typeof path !== "string" || path.includes("..") || path.length > 400) {
    return false;
  }
  const gcsRe = new RegExp(
    `^uploads/${userId.replace(/[^a-f0-9-]/gi, "")}/[0-9a-f-]{36}\\.(step|stp|iges|igs|stl|pdf|dwg|dxf|png|jpg)$`,
    "i"
  );
  if (gcsRe.test(path)) return true;
  return path.startsWith(`${userId}/`);
}

/**
 * Issues a 10-minute V4 GET signed URL for a single object path.
 *
 * SECURITY RULE: Callers MUST only pass `objectPath` values fetched from a
 * Supabase query executed with the user's own RLS-scoped session (`rfqs`,
 * `cad_analyses`, or `orders`). Never pass a raw browser-supplied path.
 */
export async function signAttachmentDownloadUrl(
  supabase: SupabaseClient<Database>,
  objectPath: string,
  options?: { inline?: boolean; downloadFileName?: string; expiresInSeconds?: number }
): Promise<string | null> {
  if (!objectPath || objectPath.includes("..")) return null;
  const expiresSec = options?.expiresInSeconds ?? 10 * 60; // 10 minutes default

  const bucketName = process.env.GCS_CAD_BUCKET;
  if (bucketName && isGcsObjectPath(objectPath)) {
    try {
      const safeDownloadName = (options?.downloadFileName || objectPath.split("/").pop() || "part.step")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const [url] = await getStorage()
        .bucket(bucketName)
        .file(objectPath)
        .getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + expiresSec * 1000,
          ...(options?.inline
            ? {}
            : { responseDisposition: `attachment; filename="${safeDownloadName}"` }),
        });
      return url;
    } catch (err) {
      console.error("[gcs] failed to sign download URL", err instanceof Error ? err.message : err);
      return null;
    }
  }

  const { data } = await supabase.storage
    .from(LEGACY_SUPABASE_BUCKET)
    .createSignedUrl(objectPath, expiresSec);
  return data?.signedUrl ?? null;
}

/**
 * Batch helper to sign multiple attachment paths retrieved from an RLS-verified row.
 */
export async function signAttachmentDownloadUrls(
  supabase: SupabaseClient<Database>,
  objectPaths: string[],
  expiresInSeconds = 10 * 60
): Promise<{ path: string; signedUrl: string | null }[]> {
  if (!objectPaths.length) return [];
  return Promise.all(
    objectPaths.map(async (path) => ({
      path,
      signedUrl: await signAttachmentDownloadUrl(supabase, path, { expiresInSeconds }),
    }))
  );
}

/**
 * Publishes an async CAD analysis job to GCP Pub/Sub (`PUBSUB_CAD_TOPIC`).
 */
export async function publishCadAnalysisJob(payload: {
  analysisId: string;
  objectPath: string;
  fileName: string;
  sha256?: string | null;
}): Promise<void> {
  const topicName = process.env.PUBSUB_CAD_TOPIC;
  const bucketName = process.env.GCS_CAD_BUCKET;
  if (!topicName || !bucketName) {
    throw new Error("GCS_CAD_BUCKET or PUBSUB_CAD_TOPIC is not configured.");
  }

  await getPubSub()
    .topic(topicName)
    .publishMessage({
      json: {
        analysis_id: payload.analysisId,
        bucket: bucketName,
        object_path: payload.objectPath,
        file_name: payload.fileName,
        sha256: payload.sha256 ?? null,
      },
    });
}

/**
 * Copies ordered CAD attachments from `uploads/` to `orders/{orderId}/` so the
 * 90-day lifecycle deletion rule on `uploads/` and `derived/` preserves active orders.
 */
export async function promoteCadFilesToOrderPrefix(
  orderId: string,
  objectPaths: string[]
): Promise<string[]> {
  const bucketName = process.env.GCS_CAD_BUCKET;
  if (!bucketName || !objectPaths.length) return objectPaths;

  const bucket = getStorage().bucket(bucketName);
  const updated: string[] = [];

  for (const p of objectPaths) {
    if (!p.startsWith("uploads/")) {
      updated.push(p);
      continue;
    }
    const baseName = p.split("/").pop()!;
    const destPath = `orders/${orderId}/${baseName}`;
    try {
      await bucket.file(p).copy(bucket.file(destPath));
      updated.push(destPath);
    } catch {
      updated.push(p);
    }
  }
  return updated;
}
