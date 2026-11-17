import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Repository } from './repo.js';
import type { SessionRow, UserRow } from './types.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

/** Issues an opaque bearer token; returns the raw token (client-side) and its SHA-256 (stored). */
export function issueToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function constantTimeTokenEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface AuthContext {
  user: UserRow;
  session: SessionRow;
}

/** Validates a bearer token against the repo. Constant-time on the stored hash lookup path. */
export async function authenticateBearer(repo: Repository, token: string): Promise<AuthContext | null> {
  const tokenHash = hashToken(token);
  const session = await repo.findActiveSessionByTokenHash(tokenHash, new Date());
  if (!session) return null;
  const user = await repo.findUserById(session.userId);
  if (!user) return null;
  return { user, session };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

export function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}
