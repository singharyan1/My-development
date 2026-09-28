const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || '');
let ready;
// Creates the tables on first use, so there is nothing to run by hand.
function init() {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS votes (voter_hash text PRIMARY KEY, choice text NOT NULL)`;
      await sql`CREATE TABLE IF NOT EXISTS participants (id serial PRIMARY KEY, name text, address text, phone text, occupation text, choice text, created_on date DEFAULT CURRENT_DATE)`;
      await sql`CREATE TABLE IF NOT EXISTS attempts (key text PRIMARY KEY, n int NOT NULL, win bigint NOT NULL)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
module.exports = { sql, init };
