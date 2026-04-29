import { describe, it, expect } from "vitest";
import {
  encryptBankDetails,
  decryptBankDetails,
  isEncryptedField,
} from "@/lib/vendorEncryption";
import type { BankDetails, EncryptedField } from "@/types";

const sample: BankDetails = {
  bank_name: "Bank of Studio",
  account_holder: "StudioBlack Ltd",
  account_number: "0123456789",
  iban: "GB29NWBK60161331926819",
  swift: "NWBKGB2L",
  branch: "London",
};

describe("vendorEncryption", () => {
  it("round-trips a bank details object", () => {
    const envelope = encryptBankDetails(sample);
    expect(envelope.version).toBe(1);
    expect(envelope.encrypted).toBeTruthy();
    expect(envelope.iv).toBeTruthy();
    expect(envelope.tag).toBeTruthy();

    const decrypted = decryptBankDetails(envelope);
    expect(decrypted).toEqual(sample);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encryptBankDetails(sample);
    const b = encryptBankDetails(sample);
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const envelope = encryptBankDetails(sample);
    // Flip the first byte of ciphertext.
    const buf = Buffer.from(envelope.encrypted, "base64");
    buf[0] = buf[0] ^ 0xff;
    const tampered: EncryptedField = {
      ...envelope,
      encrypted: buf.toString("base64"),
    };
    expect(() => decryptBankDetails(tampered)).toThrow();
  });

  it("throws on a tampered auth tag", () => {
    const envelope = encryptBankDetails(sample);
    const buf = Buffer.from(envelope.tag, "base64");
    buf[0] = buf[0] ^ 0xff;
    const tampered: EncryptedField = {
      ...envelope,
      tag: buf.toString("base64"),
    };
    expect(() => decryptBankDetails(tampered)).toThrow();
  });

  it("rejects unsupported envelope versions", () => {
    const envelope = encryptBankDetails(sample);
    const future = { ...envelope, version: 2 } as unknown as EncryptedField;
    expect(() => decryptBankDetails(future)).toThrow(/version/i);
  });

  it("isEncryptedField narrows valid envelopes", () => {
    const envelope = encryptBankDetails(sample);
    expect(isEncryptedField(envelope)).toBe(true);
  });

  it("isEncryptedField rejects malformed values", () => {
    expect(isEncryptedField(null)).toBe(false);
    expect(isEncryptedField(undefined)).toBe(false);
    expect(isEncryptedField({})).toBe(false);
    expect(isEncryptedField({ version: 1, encrypted: "x" })).toBe(false);
    expect(
      isEncryptedField({ version: 2, encrypted: "x", iv: "y", tag: "z" })
    ).toBe(false);
  });

  it("preserves partial bank details (optional fields)", () => {
    const partial: BankDetails = { iban: "GB29NWBK60161331926819" };
    const envelope = encryptBankDetails(partial);
    expect(decryptBankDetails(envelope)).toEqual(partial);
  });
});
