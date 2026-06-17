# Subsurface - Spotify KNN Finder

Subsurface is a Spotify-powered artist discovery app. Users enter artists they already like, then the app recommends nearby artists using official Spotify catalog fields: artist followers, popularity, genres, images, Spotify profile URLs and top-track artist networks.

The model explanation has moved out of the website and into `MODEL_EXPLANATION.md` so the product UI stays focused.

## Current Model

- Data source: Spotify Web API.
- Main model: K-Nearest Neighbors style artist similarity.
- Supporting layer: clustering-style taste groups for Replay and Taste Lab.
- Features: `followers.total`, `popularity`, genre multi-hot signals and top-track artist network overlap.

Spotify's official Web API does not expose artist monthly listeners. This project therefore uses `followers.total` and `popularity` as official Spotify scale signals.

## Features

- Discover page with three seed artists and Spotify-only recommendation results.
- Filter stack for genre, maximum Spotify followers, minimum KNN score and mood target.
- Artist profile page with portrait, Spotify followers, popularity, tags, top tracks and profile link.
- Search history with click-to-open popup details.
- Taste Lab with genre gravity and cluster summaries.
- Replay 26' page with concise discovery identity layout.
- Immersive frosted dark blue-gray interface with smooth page transitions.

## Environment Variables

Create these variables in Vercel or Netlify project settings:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Do not expose `SPOTIFY_CLIENT_SECRET` in browser-side `VITE_` variables.

## Running Locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

For full Spotify recommendations, deploy on Vercel or Netlify so the serverless routes can run.

## Validation

```bash
npm run build
npm run lint
```

On Windows paths containing `&`, call the local binaries directly if `npm run` is split by the shell:

```bash
node .\node_modules\vite\bin\vite.js build
node .\node_modules\eslint\bin\eslint.js .
```
