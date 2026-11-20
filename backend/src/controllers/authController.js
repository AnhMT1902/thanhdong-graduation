import { parse, loginSchema } from '../validation.js';
import { cookieOptions, sessionMaxAge } from '../config/auth.js';
import { login, logout } from '../services/authService.js';

async function loginAs(role, request, response) {
  const value = parse(loginSchema, request.body);
  const result = await login({ identifier: value.identifier.toLowerCase(), password: value.password, role, ip: request.ip, currentToken: request.cookies.quizify_session });
  response.cookie('quizify_session', result.token, { ...cookieOptions, maxAge: sessionMaxAge });
  if (request.is('application/x-www-form-urlencoded') && request.accepts('html') && request.get('X-Requested-With') !== 'Quizify') {
    return response.redirect(303, role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  }
  response.json(result.user);
}

export const loginStudent = (request, response) => loginAs('student', request, response);
export const loginAdmin = (request, response) => loginAs('admin', request, response);

export async function logoutUser(request, response) {
  await logout(request.cookies.quizify_session);
  response.clearCookie('quizify_session', cookieOptions);
  response.json({ loggedOut: true });
}

export function currentUser(request, response) { response.json(request.user); }