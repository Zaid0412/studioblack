import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from "node:crypto";
import { env } from "@/env";
import type { BankDetails, EncryptedField } from "@/types";

/**
 * AES-256-GCM encryption for vendor `bank_details`.
 *
 * The envelope carries a `version` field so a future key-rotation migration
 * can support multiple keys side-by-side without re-encrypting existing rows.
 * For F7 only `version: 1` exists.
 */

const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — the recommended IV size for GCM.

function getKey(): Buffer {
  const hex = env().VENDOR_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "VENDOR_ENCRYPTION_KEY is not configured. Generate one with " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a `BankDetails` object into a storable envelope. */
export function encryptBankDetails(plain: BankDetails): EncryptedField {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(JSON.stringify(plain), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    encrypted: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/** Decrypt an envelope back to `BankDetails`. Throws on tampering or bad key. */
export function decryptBankDetails(envelope: EncryptedField): BankDetails {
  if (envelope.version !== 1) {
    throw new Error(
      `Unsupported bank details envelope version: ${envelope.version}`
    );
  }

  const key = getKey();
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.encrypted, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as BankDetails;
}

/** Type guard — narrows an unknown DB value into the envelope shape. */
export function isEncryptedField(value: unknown): value is EncryptedField {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.encrypted === "string" &&
    typeof v.iv === "string" &&
    typeof v.tag === "string"
  );
}
