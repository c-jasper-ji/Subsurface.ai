let cachedToken = null

const FALLBACK_GENRES = ['alternative r&b', 'indie soul', 'electronic', 'neo soul', 'art pop']

function send(res, status, payload) {
  res.status(status).json(payload)
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
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

async function getArtistByName(name, token) {
  const data = await spotify('/search', token, {
    q: name,
    type: 'artist',
    limit: '1',
  })
  return data.artists?.items?.[0] || null
}

async function getArtistById(id, token) {
  try {
    return await spotify(`/artists/${id}`, token)
  } catch {
    return null
  }
}

async function searchArtists(query, token, limit = 8) {
  const data = await spotify('/search', token, {
    q: query,
    type: 'artist',
    limit: String(limit),
  })
  return data.artists?.items || []
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

function genreOverlap(candidateGenres, seedGenres) {
  const candidateTokens = new Set(candidateGenres.flatMap((genre) => normalizeText(genre).split(' ')))
  const seedTokens = new Set(seedGenres.flatMap((genre) => normalizeText(genre).split(' ')))
  if (!candidateTokens.size || !seedTokens.size) return 0
  const overlap = [...candidateTokens].filter((token) => seedTokens.has(token)).length
  return overlap / Math.max(candidateTokens.size, seedTokens.size)
}

function normalizedFollowers(followers, maxFollowers) {
  if (!followers || !maxFollowers) return 0
  return Math.log10(followers + 1) / Math.log10(maxFollowers + 1)
}

function scoreArtist(candidate, context) {
  const followersNorm = normalizedFollowers(candidate.followers?.total || 0, context.maxFollowers)
  const noveltyScore = 1 - followersNorm
  const popularityFit = 1 - Math.abs((candidate.popularity ?? 50) - context.avgPopularity) / 100
  const genreScore = genreOverlap(candidate.genres || [], context.seedGenres)
  const networkScore = Math.min(1, (candidate.sourceCount || 0) / Math.max(context.seedCount, 1))
  const score = genreScore * 42 + networkScore * 24 + noveltyScore * 20 + popularityFit * 14

  return {
    score: Math.round(Math.max(1, Math.min(99, score))),
    match: Math.max(0.1, Math.min(0.99, genreScore * 0.6 + networkScore * 0.3 + popularityFit * 0.1)),
    noveltyScore,
    genreScore,
    popularityFit,
  }
}

function toClientArtist(artist, scoreParts, topTracks, sources) {
  return {
    id: artist.id,
    name: artist.name,
    followers: artist.followers?.total ?? 0,
    listeners: artist.followers?.total ?? 0,
    popularity: artist.popularity ?? 0,
    score: scoreParts.score,
    match: scoreParts.match,
    noveltyScore: scoreParts.noveltyScore,
    genreScore: scoreParts.genreScore,
    popularityFit: scoreParts.popularityFit,
    sources,
    sourceCount: sources.length,
    tags: artist.genres || [],
    topTracks: topTracks.map((track) => track.name).slice(0, 3),
    image: artist.images?.[0]?.url || '',
    spotifyUrl: artist.external_urls?.spotify || '',
    bio: 'Spotify catalog profile built from artist followers, popularity, genres and top-track network signals.',
    cluster: inferCluster(artist.genres || []),
  }
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
    .slice(0, 5)

  if (!seeds.length) {
    send(res, 400, { error: 'Missing seed artists' })
    return
  }

  try {
    const token = await getSpotifyToken()
    const seedArtists = (await Promise.all(seeds.map((name) => getArtistByName(name, token)))).filter(Boolean)
    const seedIds = new Set(seedArtists.map((artist) => artist.id))
    const seedNames = new Set(seedArtists.map((artist) => normalizeText(artist.name)))
    const seedGenres = [...new Set(seedArtists.flatMap((artist) => artist.genres || []))]
    const avgPopularity =
      seedArtists.reduce((sum, artist) => sum + (artist.popularity ?? 50), 0) / Math.max(seedArtists.length, 1)

    const seedTracks = await Promise.all(seedArtists.map((artist) => getTopTracks(artist.id, token)))
    const candidateMap = new Map()

    seedTracks.forEach((tracks, index) => {
      tracks.forEach((track) => {
        track.artists.forEach((artist) => {
          if (seedIds.has(artist.id)) return
          const existing = candidateMap.get(artist.id) || {
            id: artist.id,
            name: artist.name,
            artist: null,
            sources: new Set(),
            sourceCount: 0,
          }
          existing.sources.add(seedArtists[index].name)
          existing.sourceCount = existing.sources.size
          candidateMap.set(artist.id, existing)
        })
      })
    })

    const genreQueries = (seedGenres.length ? seedGenres : FALLBACK_GENRES).slice(0, 5)
    const genreResults = await Promise.all(
      genreQueries.flatMap((genre) => [
        searchArtists(`genre:"${genre}"`, token, 8),
        searchArtists(genre, token, 5),
      ])
    )
    genreResults.flat().forEach((artist) => {
      if (seedIds.has(artist.id) || seedNames.has(normalizeText(artist.name))) return
      const existing = candidateMap.get(artist.id) || {
        id: artist.id,
        name: artist.name,
        artist,
        sources: new Set(),
        sourceCount: 0,
      }
      existing.artist = existing.artist || artist
      existing.sources.add('genre match')
      existing.sourceCount = existing.sources.size
      candidateMap.set(artist.id, existing)
    })

    const candidateIds = [...candidateMap.keys()].slice(0, 40)
    if (!candidateIds.length) {
      send(res, 200, { seeds: seedArtists, results: [] })
      return
    }

    const artistDetails = (
      await Promise.all(
        candidateIds.map(async (id) => {
          const meta = candidateMap.get(id)
          if (meta?.artist) return meta.artist
          const byId = await getArtistById(id, token)
          if (byId) return byId
          return meta?.name ? getArtistByName(meta.name, token) : null
        })
      )
    ).filter(Boolean)

    const maxFollowers = Math.max(...artistDetails.map((artist) => artist.followers?.total || 0), 1)
    const context = { seedGenres, avgPopularity, maxFollowers, seedCount: seedArtists.length }

    const enriched = await Promise.all(
      artistDetails
        .filter(Boolean)
        .map(async (artist) => {
          const meta = candidateMap.get(artist.id)
          const scoreParts = scoreArtist({ ...artist, sourceCount: meta?.sourceCount || 0 }, context)
          const topTracks = await getTopTracks(artist.id, token)
          return toClientArtist(artist, scoreParts, topTracks, [...(meta?.sources || [])])
        })
    )

    const results = enriched
      .filter((artist) => artist.followers > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400')
    send(res, 200, {
      seeds: seedArtists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        followers: artist.followers?.total || 0,
        popularity: artist.popularity ?? 0,
        genres: artist.genres || [],
        image: artist.images?.[0]?.url || '',
        spotifyUrl: artist.external_urls?.spotify || '',
      })),
      results,
      model: {
        type: 'Spotify KNN + Clustering',
        variables: ['followers.total', 'popularity', 'genres', 'top track artist network'],
      },
    })
  } catch (error) {
    send(res, 500, { error: error.message || 'Spotify discovery failed' })
  }
}
