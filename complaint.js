const crypto = require('crypto');
const { sql, init } = require('../lib/db');

const CATEGORIES = ['land', 'compensation', 'information', 'environment', 'other'];
const MAX_PER_HOUR = 10;

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}
function clean(v, max) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { VOTE_SECRET } = process.env;
  if (!VOTE_SECRET) return res.status(500).json({ error: 'not_configured' });

  const d = req.body || {};
  // Honeypot: a hidden field real people never fill in. If it has a value, silently pretend success.
  if (d.website) return res.status(200).json({ ok: true });

  const category = CATEGORIES.includes(d.category) ? d.category : null;
  const description = clean(d.description, 1000);
  const area = clean(d.area, 150);
  const name = clean(d.name, 100);
  const phone = String(d.phone || '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');

  if (!category || description.length < 10) {
    return res.status(400).json({ error: 'bad_details' });
  }
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: 'bad_phone' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown';

  try {
    await init();
    const win = Math.floor(Date.now() / 3600000);
    const rl = await sql`INSERT INTO complaint_attempts (key, n, win) VALUES (${hmac(VOTE_SECRET, ip)}, 1, ${win})
      ON CONFLICT (key) DO UPDATE SET n = CASE WHEN complaint_attempts.win = ${win} THEN complaint_attempts.n + 1 ELSE 1 END, win = ${win} RETURNING n`;
    if (rl[0].n > MAX_PER_HOUR) return res.status(429).json({ error: 'rate_limited' });

    await sql`INSERT INTO complaints (category, description, area, name, phone) VALUES (${category}, ${description}, ${area || null}, ${name || null}, ${phone || null})`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('complaint error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
