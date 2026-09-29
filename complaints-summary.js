const { sql, init } = require('../lib/db');

// Public endpoint: category counts and a total ONLY. Never returns individual
// complaints, names, phone numbers or descriptions.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    await init();
    const rows = await sql`SELECT category, count(*)::int AS n FROM complaints GROUP BY category`;
    const counts = { land: 0, compensation: 0, information: 0, environment: 0, other: 0 };
    let total = 0;
    rows.forEach((r) => { if (r.category in counts) { counts[r.category] = r.n; total += r.n; } });
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ counts, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
