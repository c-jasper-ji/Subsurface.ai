# Subsurface — Team Handoff Document

> *Skip the algorithm. Discover underground artists based on what you already love.*

---

## What We Built

Subsurface is a music discovery web app that takes 3 artists you love and recommends niche, under-the-radar artists you haven't heard yet — bypassing mainstream recommendation algorithms.

**Live site:** https://thriving-squirrel-d563ad.netlify.app
**GitHub repo:** https://github.com/samridhiswarup-afk/Music-Finder

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React + Vite | Frontend framework |
| Tailwind CSS | Styling |
| Last.fm API | Artist similarity data + top tracks + genres |
| Spotify API | Artist photos + direct profile links |
| Netlify | Free hosting |

---

## How the Recommendation Model Works

1. User types 3 artists they love
2. App calls Last.fm's `artist.getSimilar` for each — returns up to 50 similar artists per input
3. All results are combined and deduplicated
4. **Filters applied:**
   - Removes artists the user already typed (fuzzy matched — handles punctuation/case differences)
   - Removes combined artist names (e.g. "Jay-Z & Kanye", "Illenium, Jon Bellion")
   - Removes artists with over 1 million Last.fm listeners
5. **Niche scoring:** artists that appear in only 1–2 of the 3 similar lists score higher than artists that appear in all 3 (appearing in everyone's list = too mainstream)
6. Top 10 results shown as cards with artist photo, genres, and top 3 tracks

---

## What Spotify Is Used For

- Artist **photos** on the result cards
- Direct **Spotify profile links** when clicking a card
- Users click "Connect Spotify" and log in once — the token is saved so they stay connected

> Note: Spotify's related-artists and recommendations APIs were deprecated in November 2024, so Last.fm is used for the actual recommendation engine.

---

## Known Limitations

- **Regional bias:** Last.fm's dataset skews Western. For Indian/non-Western artists, the similar artist pool tends to return other well-known regional artists rather than truly niche ones — because Last.fm simply doesn't have deep data for those markets.
- **Spotify token expiry:** Tokens expire after ~1 hour. Users need to reconnect Spotify after that. A future fix would use refresh tokens.
- **Last.fm images:** Last.fm stopped serving artist images in ~2022, which is why we use Spotify for photos.

---

## Project Structure

```
music-finder/
├── src/
│   ├── App.jsx        # Main app — all UI and recommendation logic
│   ├── spotify.js     # Spotify OAuth + search helpers
│   ├── index.css      # Global styles + Tailwind import
│   └── main.jsx       # React entry point
├── index.html         # App shell + Google Fonts
├── vite.config.js     # Vite + Tailwind plugin config
├── .env               # API keys (never commit this)
└── .gitignore         # Excludes .env from git
```

---

## Running Locally

**Requirements:** Node.js v18+

```bash
# Install dependencies
cd music-finder
npm install

# Start dev server
npm run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:5173** in your browser.

> Use `127.0.0.1` not `localhost` — Spotify's OAuth redirect requires this exact address.

---

## Environment Variables

Create a `.env` file in the project root:

```
VITE_LASTFM_KEY=your_lastfm_api_key
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Get a Last.fm key at: https://www.last.fm/api/account/create
Get Spotify credentials at: https://developer.spotify.com/dashboard

---

## Deploying to Netlify

1. Run `npm run build` — creates a `dist/` folder
2. Zip the `dist/` folder
3. Drag the zip to Netlify's **Production deploys** drop zone
4. Add environment variables under **Project configuration → Environment variables**
5. Trigger a redeploy

---

## What Could Be Added Next

- [ ] Recommendation reason on each card ("Similar to Taylor Swift")
- [ ] Spotify refresh tokens so users don't need to reconnect
- [ ] Better regional music support via a different data source
- [ ] Mobile-optimised layout
- [ ] Save/export your recommendations list
- [ ] Visual explanation of the algorithm

---

*Built with Last.fm & Spotify APIs · Hosted on Netlify*
