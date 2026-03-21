import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'default-secret-key-fallback-123456789';
  if (!process.env.ENCRYPTION_KEY) {
    console.warn("⚠️ WARNING: ENCRYPTION_KEY is missing from your .env file. Using an insecure fallback key.");
  }
  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string | null | undefined): string {
  if (!plaintext) return "";
  if (plaintext.includes(':') && plaintext.split(':').length === 3) return plaintext; // Already encrypted
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
