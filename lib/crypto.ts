import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer | null {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    return null;
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plainText: string): string {
  const key = getEncryptionKey();
  if (!key) {
    return plainText;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  if (!key) {
    return encryptedText;
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    return encryptedText;
  }

  const [ivBase64, encryptedBase64, authTagBase64] = parts;

  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) {
    return false;
  }
  return Buffer.from(parts[0], "base64").length === IV_LENGTH;
}

export function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••";
  }
  return "••••" + token.slice(-4);
}
