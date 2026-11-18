import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const id = () => randomUUID();
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');

export function createTrustedOrigins(publicOrigin) {
  let configured;
  try { configured = new URL(publicOrigin); }
  catch { throw new Error('PUBLIC_ORIGIN phải là origin HTTP(S) hợp lệ'); }
  if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) throw new Error('PUBLIC_ORIGIN phải là origin HTTP(S), không có credentials, path, query hoặc fragment');
  const origins = new Set([configured.origin]);
  if (['localhost', '127.0.0.1'].includes(configured.hostname)) {
    const alias = new URL(configured.origin);
    alias.hostname = configured.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.add(alias.origin);
  }
  return origins;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, hash) {
  const [algorithm, salt, value] = hash.split(':');
  if (algorithm !== 'scrypt') return false;
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(value, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function assert(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}

export async function audit(client, actor, type, target, action, metadata = {}) {
  await client.query('INSERT INTO audit_logs(id,actor_id,target_type,target_id,action,metadata) VALUES($1,$2,$3,$4,$5,$6)', [id(), actor, type, target, action, metadata]);
}
