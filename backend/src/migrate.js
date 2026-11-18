import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool, transaction } from './db.js';

export async function migrate() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('quizify_migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const folder = fileURLToPath(new URL('../migrations/', import.meta.url));
    for (const name of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort()) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
      if (!exists.rowCount) {
        await client.query(await readFile(`${folder}/${name}`, 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
  await pool.end();
}
