import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const value = process.env.SETTINGS_ENCRYPTION_KEY?.trim() ?? "";
  if (value.length < 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }

  return createHash("sha256").update(value, "utf8").digest();
}

export function encryptSetting(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function decryptSetting(ciphertext: string): string {
  const payload = Buffer.from(ciphertext, "base64url");
  if (payload.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error("Stored integration secret is malformed.");
  }

  const iv = payload.subarray(0, IV_BYTES);
  const authTag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = payload.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function checkSettingsEncryption(): boolean {
  const probe = "settings-encryption-healthcheck";
  return decryptSetting(encryptSetting(probe)) === probe;
}
