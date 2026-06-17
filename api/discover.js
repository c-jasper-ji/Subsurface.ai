let cachedToken = null

function send(res, status, payload) {
  res.status(status).json(payload)
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

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
  if (!response.ok) return null

  const data = await response.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

async function searchSpotifyArtist(name, token) {
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const artist = data.artists?.items?.[0]
    if (!artist) return null
    return {
      url: artist.external_urls?.spotify || '',
      image: artist.images?.[1]?.url || artist.images?.[0]?.url || '',
    }
  } catch {
    return null
  }
}

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const LASTFM_KEY = process.env.LASTFM_KEY

async function lastfmGetSimilar(artist) {
  const url = `${LASTFM_BASE}?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_KEY}&format=json&limit=50`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) return { error: data.message, results: [] }
  return { error: null, results: data.similarartists?.artist || [] }
}

async function lastfmGetArtistInfo(artistName) {
  const [infoRes, tracksRes] = await Promise.all([
    fetch(`${LASTFM_BASE}?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_KEY}&format=json`),
    fetch(`${LASTFM_BASE}?method=artist.gettoptracks&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_KEY}&format=json&limit=3`),
  ])
  const [info, tracks] = await Promise.all([infoRes.json(), tracksRes.json()])
  return {
    listeners: parseInt(info.artist?.stats?.listeners || '0', 10),
    genres: (info.artist?.tags?.tag || []).slice(0, 3).map((t) => t.name),
    topTracks: (tracks.toptracks?.track || []).slice(0, 3).map((t) => t.name),
  }
}

function isInputArtist(name, normalizedInputs) {
  const norm = normalizeText(name)
  return normalizedInputs.some((input) => norm.includes(input) || input.includes(norm))
}

function isCombined(name) {
  if (name.includes(',')) return true
  if (/\s(&|x|and|feat\.?|ft\.?|vs\.?|\+)\s/i.test(name)) return true
  return false
}

function inferCluster(genres) {
  const text = genres.join(' ').toLowerCase()
  if (/(r&b|soul|neo soul)/.test(text)) return 'Alt R&B / Soul'
  if (/(electronic|house|dance|ambient|experimental)/.test(text)) return 'Electronic Edge'
  if (/(indie|art pop|pop)/.test(text)) return 'Indie Pop Signal'
  if (/(rap|hip hop|trap)/.test(text)) return 'Rap Adjacent'
  return 'Discovery Cluster'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const seeds = String(req.query.artists || '')
    .split(',')
    .map((artist) => artist.trim())
    .filter(Boolean)
    .slice(0, 3)

  if (!seeds.length) {
    send(res, 400, { error: 'Missing seed artists' })
    return
  }
  if (!LASTFM_KEY) {
    send(res, 500, { error: 'Missing LASTFM_KEY server environment variable' })
    return
  }

  try {
    const responses = await Promise.all(seeds.map(lastfmGetSimilar))
    responses.forEach((r, i) => {
      if (r.error) console.error('Last.fm error for', seeds[i], ':', r.error)
    })
    const seedFound = seeds.filter((_, i) => !responses[i].error)

    const seenMap = new Map()
    responses.forEach(({ results: list }, inputIndex) => {
      for (const artist of list) {
        const key = artist.name.toLowerCase()
        const match = parseFloat(artist.match)
        if (!seenMap.has(key)) {
          seenMap.set(key, { name: artist.name, match, appearsIn: new Set() })
        }
        const entry = seenMap.get(key)
        if (match > entry.match) entry.match = match
        entry.appearsIn.add(inputIndex)
      }
    })

    const normalizedInputs = seeds.map(normalizeText)

    const candidates = [...seenMap.values()]
      .filter((a) => !isInputArtist(a.name, normalizedInputs) && !isCombined(a.name))
      .map((a) => ({
        ...a,
        nicheScore: a.match * (1 - (a.appearsIn.size - 1) / seeds.length),
      }))
      .sort((a, b) => b.nicheScore - a.nicheScore)
      .slice(0, 24)

    const withInfo = await Promise.all(
      candidates.map(async (a) => ({ ...a, ...(await lastfmGetArtistInfo(a.name)) }))
    )

    const filtered = withInfo
      .filter((a) => a.listeners > 0 && a.listeners < 1_500_000)
      .slice(0, 20)

    const spotifyToken = await getSpotifyToken()
    const enriched = await Promise.all(
      filtered.map(async (a) => {
        const spotifyData = await searchSpotifyArtist(a.name, spotifyToken)
        const score = Math.round(Math.min(99, Math.max(1, a.nicheScore * 100)))
        return {
          id: a.name,
          name: a.name,
          image: spotifyData?.image || '',
          spotifyUrl: spotifyData?.url || '',
          tags: a.genres?.length ? a.genres : ['discovery'],
          topTracks: a.topTracks || [],
          monthlyListeners: a.listeners,
          listeners: a.listeners,
          followers: a.listeners,
          popularity: score,
          score,
          match: Math.max(0.1, Math.min(0.99, a.nicheScore)),
          cluster: inferCluster(a.genres || []),
          sources: [...a.appearsIn].map((i) => seeds[i]),
        }
      })
    )

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    send(res, 200, {
      seeds: seedFound.map((name) => ({ name })),
      results: enriched.sort((a, b) => b.score - a.score),
      model: {
        type: 'Last.fm similarity + niche scoring',
        variables: ['artist similarity match', 'cross-list appearance', 'Last.fm listener count'],
      },
    })
  } catch (error) {
    send(res, 500, { error: error.message || 'Discovery failed' })
  }
}
