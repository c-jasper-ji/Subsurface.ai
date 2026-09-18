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

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function scoreCandidate(candidate, seedCount) {
  const matchValues = [...candidate.matches.values()]
  const averageMatch = matchValues.reduce((sum, value) => sum + value, 0) / Math.max(matchValues.length, 1)
  const relevance = clamp(candidate.maxMatch * 0.72 + averageMatch * 0.28)
  const consensus = clamp(candidate.appearsIn.size / Math.max(seedCount, 1))

  const minReliableListeners = 10_000
  const listenerCeiling = 1_500_000
  const listenerPosition = clamp(
    (Math.log10(candidate.listeners + 1) - Math.log10(minReliableListeners)) /
      (Math.log10(listenerCeiling) - Math.log10(minReliableListeners))
  )
  const discovery = 1 - listenerPosition * 0.75

  const metadataSignals = [
    candidate.listeners > 0,
    candidate.genres?.length > 0,
    candidate.topTracks?.length > 0,
  ]
  const confidence = metadataSignals.filter(Boolean).length / metadataSignals.length
  const rawScore = relevance * 0.52 + discovery * 0.22 + consensus * 0.18 + confidence * 0.08

  return {
    ...candidate,
    relevance,
    consensus,
    discovery,
    confidence,
    rawScore,
    cluster: inferCluster(candidate.genres || []),
  }
}

function diversityRerank(candidates, limit = 20) {
  const pool = [...candidates]
  const selected = []
  const clusterCounts = new Map()

  while (pool.length && selected.length < limit) {
    pool.sort((a, b) => {
      const aPenalty = (clusterCounts.get(a.cluster) || 0) * 0.045
      const bPenalty = (clusterCounts.get(b.cluster) || 0) * 0.045
      return b.rawScore - bPenalty - (a.rawScore - aPenalty)
    })
    const next = pool.shift()
    selected.push(next)
    clusterCounts.set(next.cluster, (clusterCounts.get(next.cluster) || 0) + 1)
  }

  return selected
}

function buildReason(candidate, seeds) {
  const sourceNames = [...candidate.appearsIn].map((index) => seeds[index]).filter(Boolean)
  if (sourceNames.length > 1) {
    return 'Connects ' + sourceNames.slice(0, 2).join(' and ') + ' with ' + Math.round(candidate.discovery * 100) + ' discovery fit.'
  }
  if (candidate.discovery >= 0.72) {
    return 'A lower-scale neighbor to ' + (sourceNames[0] || 'your seeds') + ' with a strong relevance signal.'
  }
  return 'A reliable bridge from ' + (sourceNames[0] || 'your seeds') + ' into ' + candidate.cluster + '.'
}

async function getLegacyDiscovery(seeds) {
  const url = new URL('https://subsurface-ai-psi.vercel.app/api/discover')
  url.searchParams.set('artists', seeds.join(','))
  const response = await fetch(url)
  if (!response.ok) throw new Error('Legacy discovery source is unavailable')
  const data = await response.json()

  const rescored = (data.results || []).map((artist) => {
    const sourceCount = Math.max(1, artist.sources?.length || 1)
    const oldConsensusPenalty = Math.max(0.34, 1 - (sourceCount - 1) / Math.max(seeds.length, 1))
    const relevance = clamp((artist.match || artist.score / 100 || 0) / oldConsensusPenalty)
    const consensus = clamp(sourceCount / Math.max(seeds.length, 1))
    const minReliableListeners = 10_000
    const listenerCeiling = 1_500_000
    const listenerPosition = clamp(
      (Math.log10((artist.listeners || 0) + 1) - Math.log10(minReliableListeners)) /
        (Math.log10(listenerCeiling) - Math.log10(minReliableListeners))
    )
    const discovery = 1 - listenerPosition * 0.75
    const confidenceSignals = [
      (artist.listeners || 0) > 0,
      artist.tags?.length > 0,
      artist.topTracks?.length > 0,
    ]
    const confidence = confidenceSignals.filter(Boolean).length / confidenceSignals.length
    const rawScore = relevance * 0.52 + discovery * 0.22 + consensus * 0.18 + confidence * 0.08
    const sourceNames = (artist.sources || []).slice(0, 2)
    const reason = sourceNames.length > 1
      ? 'Connects ' + sourceNames.join(' and ') + ' with ' + Math.round(discovery * 100) + ' discovery fit.'
      : 'A ' + (discovery >= 0.72 ? 'lower-scale neighbor' : 'reliable bridge') + ' from ' + (sourceNames[0] || 'your seeds') + '.'

    return {
      ...artist,
      match: relevance,
      score: Math.round(clamp(rawScore) * 99),
      reason,
      rawScore,
      cluster: artist.cluster || inferCluster(artist.tags || []),
      signals: {
        relevance: Math.round(relevance * 100),
        discovery: Math.round(discovery * 100),
        consensus: Math.round(consensus * 100),
        confidence: Math.round(confidence * 100),
      },
    }
  })

  return {
    seeds: data.seeds || seeds.map((name) => ({ name })),
    results: diversityRerank(rescored, 20).map((artist) => {
      const publicArtist = { ...artist }
      delete publicArtist.rawScore
      return publicArtist
    }),
    model: {
      type: 'Transparent multi-signal discovery ranking',
      version: '2.0',
      variables: ['Last.fm relevance', 'cross-seed consensus', 'listener-scale discovery fit', 'metadata confidence'],
      weights: { relevance: 0.52, discovery: 0.22, consensus: 0.18, confidence: 0.08 },
      reranking: 'cluster diversity penalty',
      dataRoute: 'secured legacy Last.fm endpoint',
    },
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
    try {
      const fallback = await getLegacyDiscovery(seeds)
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
      send(res, 200, fallback)
    } catch (error) {
      send(res, 500, { error: error.message || 'Discovery source is unavailable' })
    }
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
          seenMap.set(key, { name: artist.name, maxMatch: match, matches: new Map(), appearsIn: new Set() })
        }
        const entry = seenMap.get(key)
        if (match > entry.maxMatch) entry.maxMatch = match
        entry.matches.set(inputIndex, match)
        entry.appearsIn.add(inputIndex)
      }
    })

    const normalizedInputs = seeds.map(normalizeText)

    const candidates = [...seenMap.values()]
      .filter((a) => !isInputArtist(a.name, normalizedInputs) && !isCombined(a.name))
      .map((a) => ({
        ...a,
        preliminaryScore: a.maxMatch * 0.8 + (a.appearsIn.size / seeds.length) * 0.2,
      }))
      .sort((a, b) => b.preliminaryScore - a.preliminaryScore)
      .slice(0, 30)

    const withInfo = await Promise.all(
      candidates.map(async (a) => ({ ...a, ...(await lastfmGetArtistInfo(a.name)) }))
    )

    const scored = withInfo
      .filter((a) => a.listeners > 0 && a.listeners < 1_500_000)
      .map((candidate) => scoreCandidate(candidate, seeds.length))

    const reranked = diversityRerank(scored, 20)

    const spotifyToken = await getSpotifyToken()
    const enriched = await Promise.all(
      reranked.map(async (a) => {
        const spotifyData = await searchSpotifyArtist(a.name, spotifyToken)
        const score = Math.round(Math.min(99, Math.max(1, a.rawScore * 100)))
        return {
          id: a.name,
          name: a.name,
          image: spotifyData?.image || '',
          spotifyUrl: spotifyData?.url || '',
          tags: a.genres?.length ? a.genres : ['discovery'],
          topTracks: a.topTracks || [],
          listeners: a.listeners,
          score,
          match: a.relevance,
          cluster: a.cluster,
          sources: [...a.appearsIn].map((i) => seeds[i]),
          reason: buildReason(a, seeds),
          signals: {
            relevance: Math.round(a.relevance * 100),
            discovery: Math.round(a.discovery * 100),
            consensus: Math.round(a.consensus * 100),
            confidence: Math.round(a.confidence * 100),
          },
        }
      })
    )

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    send(res, 200, {
      seeds: seedFound.map((name) => ({ name })),
      results: enriched,
      model: {
        type: 'Transparent multi-signal discovery ranking',
        version: '2.0',
        variables: ['Last.fm relevance', 'cross-seed consensus', 'listener-scale discovery fit', 'metadata confidence'],
        weights: { relevance: 0.52, discovery: 0.22, consensus: 0.18, confidence: 0.08 },
        reranking: 'cluster diversity penalty',
      },
    })
  } catch (error) {
    send(res, 500, { error: error.message || 'Discovery failed' })
  }
}
