import { HttpError, createTrustedOrigins } from '../security.js';

const trustedOrigins = createTrustedOrigins(process.env.PUBLIC_ORIGIN || 'http://localhost:8094');

export function apiRequestGuard(request, response, next) {
  response.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('Origin');
    if (request.get('X-Requested-With') !== 'Quizify' || origin && !trustedOrigins.has(origin)) return next(new HttpError(403, 'Yêu cầu không hợp lệ hoặc khác nguồn'));
  }
  next();
}