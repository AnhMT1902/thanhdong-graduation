import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pool, transaction, camel } from './db.js';
import { admin } from './admin.js';
import { HttpError, assert, newToken, hashToken, verifyPassword, hashPassword, createTrustedOrigins } from './security.js';
import { loginSchema, profileSchema, answerSchema, parse, validId } from './validation.js';
import { assignmentsFor, activeAttempt, historyFor, startAttempt, attemptFor, saveAnswer, submitAttempt, resultsFor } from './attempts.js';

const trustedOrigins = createTrustedOrigins(process.env.PUBLIC_ORIGIN || 'http://localhost:8094');
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use('/api', (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('Origin');
    if (request.get('X-Requested-With') !== 'Quizify' || origin && !trustedOrigins.has(origin)) return next(new HttpError(403, 'Yêu cầu không hợp lệ hoặc khác nguồn'));
  }
  next();
});
app.get('/api/health', async (request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok' });
});

const loginLimits = new Map();
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/' };
for (const [route, role] of [['user', 'student'], ['admin', 'admin']]) {
  app.post(`/api/auth/${route}/login`, async (request, response) => {
    const value = parse(loginSchema, request.body);
    const identifier = value.identifier.toLowerCase();
    const key = `${request.ip}:${identifier}`;
    const now = Date.now();
    for (const [entry, limit] of loginLimits) if (limit.until <= now) loginLimits.delete(entry);
    const limit = loginLimits.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    assert(limit.count < 20, 429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút');
    const found = await pool.query('SELECT * FROM users WHERE lower(email)=$1 OR lower(student_code)=$1', [identifier]);
    const user = found.rows[0];
    const dummyHash = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
    const passwordMatches = await verifyPassword(value.password, user?.password_hash || dummyHash);
    if (!user || user.role !== role || user.status !== 'active' || !passwordMatches) {
      if (loginLimits.size < 5000) loginLimits.set(key, { ...limit, count: limit.count + 1 });
      throw new HttpError(401, 'Tài khoản hoặc mật khẩu không đúng');
    }
    loginLimits.delete(key);
    const token = newToken();
    await transaction(async client => {
      await client.query('DELETE FROM sessions WHERE expires_at<=now()');
      if (request.cookies.quizify_session) await client.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(request.cookies.quizify_session)]);
      await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')", [hashToken(token), user.id]);
      await client.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
    });
    response.cookie('quizify_session', token, { ...cookieOptions, maxAge: 12 * 60 * 60 * 1000 });
    response.json({ id: user.id, role: user.role, fullName: user.full_name });
  });
}

app.use('/api', async (request, response, next) => {
  try {
    const token = request.cookies.quizify_session;
    assert(token && typeof token === 'string' && token.length === 64, 401, 'Vui lòng đăng nhập');
    const found = await pool.query(`SELECT u.id,u.role,u.full_name,u.email,u.student_code,u.class_id,u.status,c.name AS class_name FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN classes c ON c.id=u.class_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'`, [hashToken(token)]);
    assert(found.rowCount, 401, 'Phiên đăng nhập đã hết hạn');
    request.user = camel(found.rows[0]);
    next();
  } catch (error) { next(error); }
});
app.get('/api/me', (request, response) => response.json(request.user));
app.post('/api/auth/logout', async (request, response) => {
  await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(request.cookies.quizify_session)]);
  response.clearCookie('quizify_session', cookieOptions);
  response.json({ loggedOut: true });
});
app.use('/api/admin', (request, response, next) => request.user.role === 'admin' ? next() : next(new HttpError(403, 'Chỉ Admin được truy cập')), admin);
app.use('/api/user', (request, response, next) => request.user.role === 'student' ? next() : next(new HttpError(403, 'Chỉ học sinh được truy cập')));
app.get('/api/user/dashboard', async (request, response) => {
  const assignments = await assignmentsFor(request.user.id, { pageSize: 50 });
  const results = await resultsFor(request.user.id, { pageSize: 5 });
  response.json({ user: request.user, assignmentCount: assignments.total, submittedCount: results.total, assignments: assignments.items, results: results.items, activeAttempt: await activeAttempt(request.user.id) });
});
app.get('/api/user/assignments', async (request, response) => response.json(await assignmentsFor(request.user.id, request.query)));
app.get('/api/user/assignments/:id/history', async (request, response) => response.json(await historyFor(request.user.id, validId(request.params.id))));
app.post('/api/user/assignments/:id/attempts', async (request, response) => response.status(201).json(await startAttempt(request.user.id, validId(request.params.id))));
app.get('/api/user/attempts/active', async (request, response) => response.json(await activeAttempt(request.user.id)));
app.get('/api/user/attempts/:id', async (request, response) => response.json(await attemptFor(request.user.id, validId(request.params.id))));
app.patch('/api/user/attempts/:id/answers', async (request, response) => response.json(await saveAnswer(request.user.id, validId(request.params.id), parse(answerSchema, request.body))));
app.post('/api/user/attempts/:id/submit', async (request, response) => response.json(await submitAttempt(request.user.id, validId(request.params.id))));
app.get('/api/user/results', async (request, response) => response.json(await resultsFor(request.user.id, request.query)));
app.get('/api/user/results/:id', async (request, response) => response.json(await attemptFor(request.user.id, validId(request.params.id), true)));
app.get('/api/user/profile', (request, response) => response.json(request.user));
app.patch('/api/user/profile', async (request, response) => {
  const value = parse(profileSchema, request.body);
  await transaction(async client => {
    const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [request.user.id])).rows[0];
    if (value.newPassword) {
      assert(await verifyPassword(value.currentPassword, user.password_hash), 400, 'Mật khẩu hiện tại không đúng');
      await client.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [user.id, await hashPassword(value.newPassword)]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
    }
    if (value.fullName) await client.query('UPDATE users SET full_name=$2,updated_at=now() WHERE id=$1', [user.id, value.fullName]);
  });
  if (value.newPassword) response.clearCookie('quizify_session', cookieOptions);
  response.json({ updated: true, requiresLogin: !!value.newPassword });
});
app.use((request, response, next) => next(new HttpError(404, 'Không tìm thấy API')));
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  let fields;
  if (error.code === '23505') {
    status = 409;
    const conflicts = { users_student_code_key: ['studentCode', 'Mã học sinh đã tồn tại'], users_email_key: ['email', 'Email đã tồn tại'] };
    const conflict = conflicts[error.constraint];
    if (conflict) { message = conflict[1]; fields = { [conflict[0]]: message }; }
    else message = error.constraint === 'one_active_attempt_per_student' ? 'Bạn đang có một lượt làm bài khác' : 'Dữ liệu này đã tồn tại; vui lòng kiểm tra lại';
  }
  if (error.code === '23503') { status = 409; message = 'Dữ liệu đang được sử dụng; không thể xóa hoặc thay đổi liên kết'; }
  if (error.code === '23514') { status = 400; message = 'Dữ liệu không thỏa quy tắc hệ thống'; }
  if (status >= 500) { console.error(error); message = 'Có lỗi hệ thống. Vui lòng thử lại'; }
  response.status(status).json({ error: message, ...(fields ? { fields } : {}) });
});
