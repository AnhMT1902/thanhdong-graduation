export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
};

export const sessionMaxAge = 12 * 60 * 60 * 1000;
export const dummyPasswordHash = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);