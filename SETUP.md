# Setup (all free)
1. **Google sign-in:** console.cloud.google.com > OAuth consent screen (External, then Publish app) > Credentials > OAuth client ID > Web application. Authorised JavaScript origins: https://sonepurairport.in, https://www.sonepurairport.in. Copy the Client ID.
2. **Database:** Vercel project > Storage > Create Database > **Neon** (free). Connect it to the project; Vercel adds `DATABASE_URL`. Tables are created automatically on first use.
3. **Environment variables** (Vercel > Settings): `GOOGLE_CLIENT_ID`, and `VOTE_SECRET` (long random string, never change it once voting starts). Optional: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` (free Cloudflare bot check), `LINK_DETAILS_TO_VOTE=true` (only if you want each person's details stored together with their choice; default is off, which keeps the ballot secret).
4. Copy the files into your repo, commit and push.

**Viewing the stored details:** Neon dashboard > your database > Tables > `participants` (view and export CSV). Details are never returned by any public page or API; only vote counts are.

**News:** edit `news.json` (newest first). Optional `"image": "assets/images/news/photo.jpg"` per item, for photos you own or have permission to use.
