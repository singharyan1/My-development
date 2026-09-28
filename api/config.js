// Public settings the poll page needs. Nothing secret is returned here.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  });
};
