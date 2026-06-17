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

function parseCompactNumber(value) {
  const match = String(value).match(/([\d.]+)\s*([KMB])?/i)
  if (!match) return 0
  const number = Number(match[1])
  const unit = (match[2] || '').toUpperCase()
  const multiplier = unit === 'B' ? 1_000_000_000 : unit === 'M' ? 1_000_000 : unit === 'K' ? 1_000 : 1
  return Math.round(number * multiplier)
}

function estimatePopularity(monthlyListeners) {
  if (!monthlyListeners) return null
  return Math.max(1, Math.min(100, Math.round((Math.log10(monthlyListeners + 1) / 8) * 100)))
}

async function getPublicSpotifyMetrics(artistId) {
  try {
    const response = await fetch(`https://open.spotify.com/artist/${artistId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) return {}
    const html = await response.text()
    const description =
      html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ||
      html.match(/<meta name="description" content="([^"]+)"/)?.[1] ||
      ''
    const monthlyText = description.match(/([\d.]+\s*[KMB]?)\s+monthly listeners/i)?.[1]
    const monthlyListeners = monthlyText ? parseCompactNumber(monthlyText) : 0
    return { monthlyListeners }
  } catch {
    return {}
  }
}

function normalizeArtist(artist, topTracks = [], publicMetrics = {}) {
  const monthlyListeners = publicMetrics.monthlyListeners || 0
  const followers = artist.followers?.total || monthlyListeners || 0
  const popularity = artist.popularity ?? estimatePopularity(monthlyListeners)
  return {
    id: artist.id,
    name: artist.name,
    monthlyListeners,
    followers,
    spotifyUrl: artist.external_urls?.spotify || '',
    image: artist.images?.[0]?.url || '',
    spotifyGenres: artist.genres || [],
    popularity,
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

    const [topTracks, publicMetrics] = await Promise.all([
      getTopTracks(artist.id, token),
      getPublicSpotifyMetrics(artist.id),
    ])
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    send(res, 200, { artist: normalizeArtist(artist, topTracks, publicMetrics) })
  } catch (error) {
    send(res, 500, { error: error.message || 'Spotify lookup failed' })
  }
}
