import { pool, transaction } from '../db.js';
import { assert, hashPassword, hashToken, newToken, verifyPassword, HttpError } from '../security.js';
import { dummyPasswordHash } from '../config/auth.js';
import { create, removeByTokenHash, removeExpired, removeForUser } from '../models/sessionModel.js';
import { findAuthenticatedUser, findByIdentifier, findForUpdate } from '../models/userModel.js';

const loginLimits = new Map();

export async function login({ identifier, password, role, ip, currentToken }) {
  const key = `${ip}:${identifier}`;
  const now = Date.now();
  for (const [entry, limit] of loginLimits) if (limit.until <= now) loginLimits.delete(entry);
  const limit = loginLimits.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  assert(limit.count < 20, 429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút');

  const user = await findByIdentifier(pool, identifier);
  const passwordMatches = await verifyPassword(password, user?.password_hash || dummyPasswordHash);
  if (!user || user.role !== role || user.status !== 'active' || !passwordMatches) {
    if (loginLimits.size < 5000) loginLimits.set(key, { ...limit, count: limit.count + 1 });
    throw new HttpError(401, 'Tài khoản hoặc mật khẩu không đúng');
  }

  loginLimits.delete(key);
  const token = newToken();
  await transaction(async client => {
    await removeExpired(client);
    if (currentToken) await removeByTokenHash(client, hashToken(currentToken));
    await create(client, hashToken(token), user.id);
    await client.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
  });
  return { token, user: { id: user.id, role: user.role, fullName: user.full_name } };
}

export async function authenticate(token) {
  assert(token && typeof token === 'string' && token.length === 64, 401, 'Vui lòng đăng nhập');
  const user = await findAuthenticatedUser(pool, hashToken(token));
  assert(user, 401, 'Phiên đăng nhập đã hết hạn');
  return user;
}

export async function logout(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
}

export async function updateProfile({ userId, value }) {
  await transaction(async client => {
    const user = await findForUpdate(client, userId);
    if (value.newPassword) {
      assert(await verifyPassword(value.currentPassword, user.password_hash), 400, 'Mật khẩu hiện tại không đúng');
      await client.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [user.id, await hashPassword(value.newPassword)]);
      await removeForUser(client, user.id);
    }
    if (value.fullName) await client.query('UPDATE users SET full_name=$2,updated_at=now() WHERE id=$1', [user.id, value.fullName]);
  });
}