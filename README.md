# Subsurface Next - Music Finder

Subsurface Next is a redesigned version of the original Music Finder demo. The core product idea stays the same: users enter artists they already like, then the app recommends similar but less obvious artists. This version adds a more polished dark blue-gray interface, richer filters, artist detail cards, search history, taste visualization, Replay-style summaries, and a transparent algorithm explanation for Big Data, AI and ML coursework.

## Features

- Discover page with three seed artists and Last.fm similarity search.
- Filter stack for genre/tag, maximum listener count, minimum model score and mood target.
- Artist profile page with portrait area, biography, source filters, top tracks and Spotify profile link.
- Search history stored locally for repeated exploration and classroom demo flows.
- Taste Lab page with genre gravity visualization and product insight cards.
- Replay 26 page inspired by Apple Music Replay, upgraded into a discovery identity summary.
- Algorithm page explaining variables, data cleaning steps and product impact.

## Tech Stack

| Tool | Purpose |
|---|---|
| React + Vite | Frontend application |
| Lucide React | Icon system |
| Last.fm API | Similar artists, listener counts, tags, biography and top tracks |
| Spotify API | Artist photos and profile links through a serverless proxy |
| localStorage | Demo search history |

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_LASTFM_KEY=your_lastfm_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Last.fm is required for live recommendations. Spotify keys must be stored as server-side environment variables on Vercel or Netlify. Do not expose `SPOTIFY_CLIENT_SECRET` in browser-side `VITE_` variables.

## Running Locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open the local URL shown by Vite, usually `http://127.0.0.1:5173/`.

For the complete deployed version, use Vercel or Netlify so `/api/spotify-artist` can run as a serverless function. GitHub Pages can host the UI, but it cannot securely run the Spotify secret exchange.

## Deployment

### Vercel

Add these environment variables in the Vercel project settings:

```text
VITE_LASTFM_KEY
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
```

Then deploy the repository. Vercel will build `dist` and expose the Spotify proxy at `/api/spotify-artist`.

### Netlify

Add the same environment variables in Netlify. The included `netlify.toml` maps `/api/spotify-artist` to the Netlify function at `/.netlify/functions/spotify-artist`.

## Validation

```bash
npm run build
npm run lint
```

## Recommendation Model

The product explains the recommendation score as:

```text
S = 0.62M + 0.20N + 0.18L + F
```

- `M`: Last.fm similarity match.
- `N`: source concentration, used to avoid overly generic mainstream artists.
- `L`: listener-count niche adjustment, used to lift relevant under-the-radar artists.
- `F`: user filter layer, including genre, mood, listener threshold and minimum model score.

The Algorithm page turns this into a classroom-friendly explanation of inputs, cleaning, enrichment, scoring and recommendation transparency.
