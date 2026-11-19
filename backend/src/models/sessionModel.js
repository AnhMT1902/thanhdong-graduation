export async function removeExpired(client) {
  await client.query('DELETE FROM sessions WHERE expires_at<=now()');
}

export async function removeByTokenHash(client, tokenHash) {
  await client.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]);
}

export async function create(client, tokenHash, userId) {
  await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')", [tokenHash, userId]);
}

export async function removeForUser(client, userId) {
  await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
}