import crypto from "crypto";
import pkg from "node-machine-id";

const { machineIdSync } = pkg;
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = "auto-fb-enc-salt-v1";

/**
 * Derives an encryption key from the machine ID using PBKDF2.
 * This ensures encrypted data is bound to the specific machine.
 */
function deriveKey(): Buffer {
  try {
    const machineId = machineIdSync();
    return crypto.pbkdf2Sync(machineId, SALT, 100_000, KEY_LENGTH, "sha256");
  } catch {
    // Fallback if machine-id fails (e.g. during tests)
    return crypto.pbkdf2Sync("fallback-machine-id", SALT, 100_000, KEY_LENGTH, "sha256");
  }
}

/**
 * Encrypts plain text using AES-256-GCM.
 * Returns base64-encoded string: [iv (16 bytes)][tag (16 bytes)][ciphertext]
 */
export function encrypt(plainText: string): string {
  if (!plainText) return plainText;
  try {
    const key = deriveKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  } catch (err) {
    console.error("[EncryptionService] Encrypt failed:", err);
    return plainText;
  }
}

/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext.
 * Returns original plain text or the input if decryption fails (backward compat).
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  try {
    const key = deriveKey();
    const data = Buffer.from(encryptedText, "base64");

    // If data is too short it's likely a plain-text (old data before encryption)
    if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
      return encryptedText;
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    // Return as-is if decryption fails (unencrypted legacy data)
    return encryptedText;
  }
}

/**
 * Returns the current machine ID (used for license binding).
 */
export function getMachineId(): string {
  try {
    return machineIdSync();
  } catch {
    return "unknown";
  }
}
