const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sql, init } = require('../lib/db');
const { POLL_ID, CHOICES } = require('../lib/poll');

const googleClient = new OAuth2Client();

const MAX_ATTEMPTS_PER_HOUR = 30;

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { GOOGLE_CLIENT_ID, VOTE_SECRET, TURNSTILE_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !VOTE_SECRET) {
    return res.status(500).json({ error: 'not_configured' });
  }

  const d = req.body || {};
  const { credential, choice, turnstileToken } = d;
  const clean = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
  const name = clean(d.name, 100), address = clean(d.address, 300), occupation = clean(d.occupation, 100);
  const phone = String(d.phone || '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (name.length < 2 || address.length < 5 || occupation.length < 2 || !/^[6-9]\d{9}$/.test(phone) || d.consent !== true) {
    return res.status(400).json({ error: 'bad_details' });
  }
  if (!CHOICES.includes(choice)) {
    return res.status(400).json({ error: 'bad_choice' });
  }
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) {
    return res.status(400).json({ error: 'bad_token' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown';

  try {
    // 1. Rate limit per IP (stored as a hash, never the raw address).
    await init();
    const win = Math.floor(Date.now() / 3600000);
    const rl = await sql`INSERT INTO attempts (key, n, win) VALUES (${hmac(VOTE_SECRET, ip)}, 1, ${win})
      ON CONFLICT (key) DO UPDATE SET n = CASE WHEN attempts.win = ${win} THEN attempts.n + 1 ELSE 1 END, win = ${win} RETURNING n`;
    if (rl[0].n > MAX_ATTEMPTS_PER_HOUR) return res.status(429).json({ error: 'rate_limited' });

    // 2. Bot check (only enforced when Turnstile is configured).
    if (TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(TURNSTILE_SECRET, turnstileToken, ip);
      if (!ok) return res.status(400).json({ error: 'turnstile_failed' });
    }

    // 3. Verify the Google sign-in token on the server.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: 'bad_token' });
    }
    if (!payload || !payload.sub || payload.email_verified === false) {
      return res.status(401).json({ error: 'bad_token' });
    }

    // 4. One vote per Google account. Only an irreversible hash of the account ID is stored,
    //    and it is NOT linked to the choice, so the ballot stays secret.
    // One vote per Google account, atomically: the vote row and the details row are written together
    // or not at all. By default the details are NOT linked to the choice (secret ballot).
    const voter = hmac(VOTE_SECRET, payload.sub);
    const link = process.env.LINK_DETAILS_TO_VOTE === 'true';
    const rows = await sql`WITH v AS (INSERT INTO votes (voter_hash, choice) VALUES (${voter}, ${choice}) ON CONFLICT DO NOTHING RETURNING 1)
      INSERT INTO participants (name, address, phone, occupation, choice)
      SELECT ${name}::text, ${address}::text, ${phone}::text, ${occupation}::text, ${link ? choice : null}::text FROM v RETURNING id`;
    if (!rows.length) return res.status(409).json({ error: 'already_voted' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('vote error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
