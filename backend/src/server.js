import { app } from './app.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import { expireAttempts } from './attempts.js';

await migrate();
await seed();
let running = false;
const timer = setInterval(async () => {
  if (running) return;
  running = true;
  try { await expireAttempts(); } catch (error) { console.error('Expiry worker:', error.message); }
  finally { running = false; }
}, 5000);
timer.unref();
const server = app.listen(4000, '0.0.0.0', () => console.log('Quizify API listening on 4000'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(timer);
  server.close(async () => { await pool.end(); process.exit(0); });
});
