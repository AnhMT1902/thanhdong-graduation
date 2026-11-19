import { camel } from '../db.js';

export async function findByIdentifier(pool, identifier) {
  const result = await pool.query('SELECT * FROM users WHERE lower(email)=$1 OR lower(student_code)=$1', [identifier]);
  return result.rows[0];
}

export async function findAuthenticatedUser(pool, tokenHash) {
  const result = await pool.query(`SELECT u.id,u.role,u.full_name,u.email,u.student_code,u.class_id,u.status,c.name AS class_name
    FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN classes c ON c.id=u.class_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'`, [tokenHash]);
  return result.rows[0] ? camel(result.rows[0]) : null;
}

export async function findForUpdate(client, userId) {
  const result = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId]);
  return result.rows[0];
}