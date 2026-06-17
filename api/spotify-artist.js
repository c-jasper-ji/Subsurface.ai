let cachedToken = null

function send(res, status, payload) {
  res.status(status).json(payload)
}

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify server environment variables')
  }

  if (cachedToken?.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error('Spotify token request failed')
  }

  const data = await response.json()
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.value
}

async function spotify(path, token, params = {}) {
  const url = new URL(`https://api.spotify.com/v1${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Spotify request failed: ${path}`)
  }

  return response.json()
}

function normalizeArtist(artist, topTracks = []) {
  return {
    id: artist.id,
    name: artist.name,
    followers: artist.followers?.total ?? 0,
    spotifyUrl: artist.external_urls?.spotify || '',
    image: artist.images?.[0]?.url || '',
    spotifyGenres: artist.genres || [],
    popularity: artist.popularity ?? null,
    topTracks,
  }
}

async function getArtistByName(name, token) {
  const data = await spotify('/search', token, {
    q: name,
    type: 'artist',
    limit: '1',
  })
  return data.artists?.items?.[0] || null
}

async function getTopTracks(artistId, token) {
  try {
    const data = await spotify(`/artists/${artistId}/top-tracks`, token, { market: 'US' })
    return (data.tracks || []).slice(0, 5).map((track) => ({
      id: track.id,
      name: track.name,
      popularity: track.popularity ?? 0,
      artists: (track.artists || []).map((artist) => ({
        id: artist.id,
        name: artist.name,
      })),
    }))
  } catch {
    return []
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const name = String(req.query.name || '').trim()
  if (!name) {
    send(res, 400, { error: 'Missing artist name' })
    return
  }

  try {
    const token = await getSpotifyToken()
    const artist = await getArtistByName(name, token)

    if (!artist) {
      send(res, 404, { artist: null })
      return
    }

    const topTracks = await getTopTracks(artist.id, token)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    send(res, 200, { artist: normalizeArtist(artist, topTracks) })
  } catch (error) {
    send(res, 500, { error: error.message || 'Spotify lookup failed' })
  }
}
