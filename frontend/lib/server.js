import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function requireRole(role) {
  const cookie = (await cookies()).get('quizify_session');
  if (!cookie) redirect(role === 'admin' ? '/admin-login' : '/user-login');
  const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://backend:4000'}/api/me`, { headers: { Cookie: `quizify_session=${cookie.value}` }, cache: 'no-store' });
  if (!response.ok) redirect(role === 'admin' ? '/admin-login' : '/user-login');
  const user = await response.json();
  if (user.role !== role) redirect(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  return user;
}
