import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

const scrypt = promisify(crypto.scrypt);
const SCRYPT_N = 2 ** 15;
const KEY_LEN = 64;
const SCRYPT_OPTS = { r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

// ---------- PINs ----------

/** A PIN is exactly five letters. Returns the upper-cased PIN, or null if invalid. */
export function normalizePin(input) {
  if (typeof input !== 'string') return null;
  const pin = input.trim().toUpperCase();
  return /^[A-Z]{5}$/.test(pin) ? pin : null;
}

export function randomPin() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from(crypto.randomBytes(5), (b) => letters[b % letters.length]).join('');
}

/** scrypt hash, stored as "scrypt$N$salt$hash" (hex). The PIN itself is never stored. */
export async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pin, salt, KEY_LEN, { ...SCRYPT_OPTS, N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPin(pin, stored) {
  const [scheme, n, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(pin, Buffer.from(saltHex, 'hex'), expected.length, {
    ...SCRYPT_OPTS,
    N: Number(n),
  });
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- login rate limiting ----------

/**
 * A five-letter PIN has ~11.9 million combinations, so guessing must be slow.
 * Failed attempts are counted per organization and per client address.
 */
export class LoginLimiter {
  constructor({ windowMs = 15 * 60_000, maxPerOrg = 10, maxPerIp = 5 } = {}) {
    this.windowMs = windowMs;
    this.maxPerOrg = maxPerOrg;
    this.maxPerIp = maxPerIp;
    this.failures = new Map(); // key -> timestamps of recent failures
  }

  recent(key, now) {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** Returns seconds to wait, or 0 if an attempt is allowed. */
  retryAfter(orgId, ip, now = Date.now()) {
    const checks = [
      [this.recent(`org:${orgId}`, now), this.maxPerOrg],
      [this.recent(`ip:${ip}`, now), this.maxPerIp],
    ];
    let wait = 0;
    for (const [list, max] of checks) {
      if (list.length >= max) {
        const oldest = list[list.length - max];
        wait = Math.max(wait, Math.ceil((oldest + this.windowMs - now) / 1000));
      }
    }
    return wait;
  }

  fail(orgId, ip, now = Date.now()) {
    for (const key of [`org:${orgId}`, `ip:${ip}`]) {
      this.failures.set(key, [...this.recent(key, now), now]);
    }
  }

  succeed(orgId, ip) {
    this.failures.delete(`ip:${ip}`);
    // Keep the per-org counter: a success by one client says nothing about the others.
    void orgId;
  }
}

// ---------- JWT ----------

const ALGORITHM = 'HS256';

export async function loadJwtSecret(dataDir) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(dataDir, 'jwt-secret');
  try {
    return (await fs.readFile(file, 'utf8')).trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const secret = crypto.randomBytes(48).toString('hex');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, secret + '\n', { mode: 0o600 });
    return secret;
  }
}

export class TokenService {
  constructor(secret, ttlDays) {
    this.secret = secret;
    this.ttlSeconds = Math.round(ttlDays * 86_400);
  }

  issue(org) {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000).toISOString();
    const token = jwt.sign({ name: org.name }, this.secret, {
      algorithm: ALGORITHM,
      subject: org.id,
      expiresIn: this.ttlSeconds,
    });
    return { token, expiresAt };
  }

  /** Returns the org id the token was issued for, or null. */
  verify(token) {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}

export function bearerToken(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
