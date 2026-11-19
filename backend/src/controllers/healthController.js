import { pool } from '../db.js';

export async function health(request, response) {
  await pool.query('SELECT 1');
  response.json({ status: 'ok' });
}