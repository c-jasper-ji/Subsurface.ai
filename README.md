# Subsurface

Subsurface is a music discovery app. Enter three artists you already love, and it recommends niche, under-the-radar artists you probably haven't heard yet — filtering out the mainstream names that typically dominate recommendation algorithms.

**Live app:** https://subsurface-ai-psi.vercel.app

---

## How It Works

The recommendation engine runs on **Last.fm**, which computes real listening-based artist similarity (not keyword/genre text search). **Spotify** is used only for artist photos and direct profile links.

### The algorithm

1. For each of the 3 input artists, fetch Last.fm's "similar artists" list (up to 50 per artist)
2. Combine and deduplicate all results across the three lists
3. Filter out:
   - The artists the user already typed (handles spelling/punctuation differences)
   - Combined/collab artist names (e.g. "Jay-Z & Kanye", "Drake x Future")
4. Score each candidate with a **niche score**: artists that appear in only 1–2 of the 3 similar-artist lists score higher than artists appearing in all 3 — because showing up everywhere means they're likely too mainstream
5. Filter by Last.fm listener count (under 1.5M) as a secondary mainstream check
6. Enrich the top 20 results with Spotify artist photos and profile links
7. Display results ranked by niche score, with genre tags and top 3 tracks per artist

### Why not use Spotify for recommendations?

We tried. Spotify's `related-artists` and `recommendations` endpoints were both deprecated in November 2024 and return 403 errors for new apps. Spotify's free-tier search API also has a low rate limit, and lacks genre tags for many smaller/niche artists — leading to unreliable, repetitive results when used as the core engine. Last.fm's similarity API doesn't have these limitations.

---

## Features

- Discover page — three seed artist inputs, recommendation results as cards
- Filter stack — genre, max monthly listeners, minimum match score, mood target
- Artist detail view — photo, listener count, genre tags, top 3 tracks, Spotify link
- Search history — past searches saved locally, click to reopen
- Taste Lab — genre breakdown and cluster summary of your results
- Frosted dark interface with smooth transitions

---

## Project Structure

```
Subsurface.ai/
├── api/
│   ├── discover.js          # Main recommendation engine (Last.fm + Spotify enrichment)
│   ├── spotify-artist.js    # Single artist lookup (legacy, used for artist detail enrichment)
│   └── spotify-discover.js  # Deprecated Spotify-only KNN engine (kept for reference, unused)
├── src/
│   ├── App.jsx               # All UI, pages, and frontend logic
│   ├── App.css                # Styles
│   └── main.jsx                # React entry point
├── index.html
├── vite.config.js
├── vercel.json
└── .env                      # API keys (never commit this)
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
LASTFM_KEY=your_lastfm_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

- Get a Last.fm key at: https://www.last.fm/api/account/create
- Get Spotify credentials at: https://developer.spotify.com/dashboard (requires a Spotify Premium account to register a Web API app)

None of these are prefixed with `VITE_` — they're read server-side only, inside the `api/` serverless functions, and are never exposed to the browser.

---

## Running Locally

Requires Node.js v18+ and the Vercel CLI (so the `api/` serverless functions work locally):

```bash
npm install -g vercel
npm install
vercel dev
```

On first run, `vercel dev` will prompt you to log in to a (any) Vercel account and link a project — choose **No** when asked to link to an existing project, since this is just for local testing.

Open **http://localhost:3000** in your browser.

> Plain `npm run dev` / `vite dev` will NOT work correctly — the `api/` folder requires Vercel's local function runtime to execute.

---

## Deploying

```bash
git add .
git commit -m "your message"
git push
vercel --prod
```

Then add the three environment variables (above) in the Vercel dashboard under **Settings → Environment Variables**, and trigger a redeploy so the live build picks them up.

If the deployed link asks visitors to log in to Vercel, go to **Settings → Deployment Protection** and set it to **Disabled**.

---

## Known Limitations

- **Regional bias:** Last.fm's user base skews Western, so listener counts for non-Western artists (e.g. Bollywood) can appear artificially low. The niche score (cross-list appearance) is less affected by this than a fixed listener threshold, but it's not a complete fix.
- **Spotify token/rate limits:** Spotify's free-tier API has request rate limits. If photos/links stop appearing, the app still works — it just falls back to a placeholder icon and a Spotify search link instead of a direct profile link.
- **No genre filter ground truth:** genre tags come from Last.fm's user-submitted tags, which can be inconsistent in quality across artists.

## What Could Be Added Next

- Recommendation reason per card (e.g. "Similar to Taylor Swift")
- Spotify refresh tokens so artist photo lookups don't degrade after ~1 hour
- A visual explainer of how the algorithm works
- Better regional/non-Western music support via an additional data source
