const { sql, init } = require('../lib/db');
// Public endpoint: returns vote COUNTS only, never any personal details.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    await init();
    const rows = await sql`SELECT choice, count(*)::int AS n FROM votes GROUP BY choice`;
    const c = { yes: 0, no: 0 };
    rows.forEach((r) => { if (r.choice in c) c[r.choice] = r.n; });
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10');
    return res.status(200).json({ yes: c.yes, no: c.no, total: c.yes + c.no });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
};
