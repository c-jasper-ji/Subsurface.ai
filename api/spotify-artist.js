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
    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', name)
    url.searchParams.set('type', 'artist')
    url.searchParams.set('limit', '1')

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error('Spotify artist search failed')
    }

    const data = await response.json()
    const artist = data.artists?.items?.[0]

    if (!artist) {
      send(res, 404, { artist: null })
      return
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    send(res, 200, {
      artist: {
        spotifyUrl: artist.external_urls?.spotify || '',
        image: artist.images?.[0]?.url || '',
        spotifyGenres: artist.genres || [],
        popularity: artist.popularity ?? null,
      },
    })
  } catch (error) {
    send(res, 500, { error: error.message || 'Spotify lookup failed' })
  }
}
