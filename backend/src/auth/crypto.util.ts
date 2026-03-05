import * as crypto from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Encrypt a plaintext string (e.g. MFA secret) with a key from env.
 * Returns hex string: iv + tag + ciphertext.
 */
export function encryptMfaSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LEN) {
    throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('hex');
}

/**
 * Decrypt a value produced by encryptMfaSecret.
 */
export function decryptMfaSecret(cipherHex: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LEN) {
    throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  const buf = Buffer.from(cipherHex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

/**
 * Generate a secure random token (hex) for password/MFA reset links.
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash of reset token for storage. Server stores only the hash; raw token in URL only.
 * Never log the raw token (audit A04).
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
