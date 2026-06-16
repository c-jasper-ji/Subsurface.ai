let cachedToken = null

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

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {})
  }

  const name = String(event.queryStringParameters?.name || '').trim()
  if (!name) {
    return json(400, { error: 'Missing artist name' })
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
      return json(404, { artist: null })
    }

    const result = json(200, {
      artist: {
        spotifyUrl: artist.external_urls?.spotify || '',
        image: artist.images?.[0]?.url || '',
        spotifyGenres: artist.genres || [],
        popularity: artist.popularity ?? null,
      },
    })
    result.headers['Cache-Control'] = 'public, max-age=86400'
    return result
  } catch (error) {
    return json(500, { error: error.message || 'Spotify lookup failed' })
  }
}
