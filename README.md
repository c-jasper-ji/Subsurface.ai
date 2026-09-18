# Subsurface

Subsurface is a music discovery app. Enter three artists you already love, and it recommends niche, under-the-radar artists you probably haven't heard yet — filtering out the mainstream names that typically dominate recommendation algorithms.

**Live app:** https://subsurface-ai.vercel.app

---

## How It Works

The recommendation engine runs on **Last.fm**, which computes real listening-based artist similarity (not keyword/genre text search). **Spotify** is used only for artist photos and direct profile links.

### The algorithm

1. For each of the 3 input artists, fetch Last.fm's "similar artists" list (up to 50 per artist)
2. Combine and deduplicate all results across the three lists
3. Filter out:
   - The artists the user already typed (handles spelling/punctuation differences)
   - Combined/collab artist names (e.g. "Jay-Z & Kanye", "Drake x Future")
4. Calculate four inspectable signals: **relevance** (52%), **discovery fit** (22%), **cross-seed consensus** (18%), and **metadata confidence** (8%)
5. Filter by Last.fm listener count (under 1.5M), then apply a cluster-diversity pass so one sound does not dominate the set
6. Enrich the top 20 results with Spotify artist photos and profile links
7. Display a recommendation reason and the four component scores for every artist

Cross-seed overlap is now treated as positive preference evidence rather than a proxy for mainstream popularity. Listener scale supplies the discovery component separately, which makes the ranking easier to explain and less internally contradictory.

### Why not use Spotify for recommendations?

We tried. Spotify's `related-artists` and `recommendations` endpoints were both deprecated in November 2024 and return 403 errors for new apps. Spotify's free-tier search API also has a low rate limit, and lacks genre tags for many smaller/niche artists — leading to unreliable, repetitive results when used as the core engine. Last.fm's similarity API doesn't have these limitations.

---

## Features

- One continuous four-part journey: home, discover, results, and library
- Persistent section navigation with smooth transitions and responsive mobile navigation
- Dynamic grayscale artist masonry sourced from the latest search results
- Search-to-results auto transition and an evidence-led artist detail panel
- Filters for genre, Last.fm listeners, and minimum fit score
- Local search history, taste signal, and next queue in one consolidated library
- White editorial system with a moving line asset and restrained violet-silver glass layers

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
└── .env                      # API keys (local only; ignored by Git)
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

- **Regional bias:** Last.fm's user base skews Western, so listener counts for non-Western artists (e.g. Bollywood) can appear artificially low. The multi-signal score reduces reliance on a single threshold, but it does not remove the underlying coverage bias.
- **Spotify token/rate limits:** Spotify's free-tier API has request rate limits. If photos/links stop appearing, the app still works — it just falls back to a placeholder icon and a Spotify search link instead of a direct profile link.
- **No genre filter ground truth:** genre tags come from Last.fm's user-submitted tags, which can be inconsistent in quality across artists.

## What Could Be Added Next

- Recommendation reason per card (e.g. "Similar to Taylor Swift")
- Spotify refresh tokens so artist photo lookups don't degrade after ~1 hour
- Tune ranking weights with lightweight user feedback data
- Better regional/non-Western music support via an additional data source
