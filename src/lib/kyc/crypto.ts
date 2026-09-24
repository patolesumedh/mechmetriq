import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field-level encryption for KYC data (PAN, bank account, IFSC).
 *
 * AES-256-GCM with a 32-byte key from KYC_ENCRYPTION_KEY (base64). The key
 * lives only in the server environment (Vercel env var) — never in the
 * database and never in a NEXT_PUBLIC_ variable — so a database leak alone
 * does not expose these values.
 *
 * Stored format: "v1:" + base64(iv[12] | authTag[16] | ciphertext)
 */

const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.KYC_ENCRYPTION_KEY;
  if (!raw) {
    throw new KycConfigError("KYC_ENCRYPTION_KEY is not set on the server.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new KycConfigError("KYC_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return key;
}

export class KycConfigError extends Error {}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [version, payload] = stored.split(":", 2);
  if (version !== VERSION || !payload) return null;
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function last4(value: string): string {
  return value.slice(-4);
}
