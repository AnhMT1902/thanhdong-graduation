import { HttpError } from '../security.js';
import { authenticate } from '../services/authService.js';

export async function requireAuth(request, response, next) {
  try {
    request.user = await authenticate(request.cookies.quizify_session);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role) {
  return (request, response, next) => request.user?.role === role
    ? next()
    : next(new HttpError(403, role === 'admin' ? 'Chỉ Admin được truy cập' : 'Chỉ học sinh được truy cập'));
}