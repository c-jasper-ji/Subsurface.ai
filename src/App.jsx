import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Clock3,
  Disc3,
  ExternalLink,
  Filter,
  Headphones,
  History,
  Info,
  Loader2,
  Music2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import './App.css'

const LASTFM_KEY = import.meta.env.VITE_LASTFM_KEY
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const HISTORY_KEY = 'subsurface-next-history'

const DEFAULT_INPUTS = ['FKA twigs', 'James Blake', 'Sampha']

const DISCOVERY_TAGS = [
  'all',
  'indie',
  'electronic',
  'r&b',
  'soul',
  'ambient',
  'jazz',
  'folk',
  'rock',
  'pop',
]

const MOCK_ARTISTS = [
  {
    name: 'Kelela',
    listeners: 452000,
    match: 0.92,
    score: 91,
    sources: ['FKA twigs', 'Sampha'],
    tags: ['r&b', 'electronic', 'alternative'],
    topTracks: ['Rewind', 'Contact', 'Enough for Love'],
    bio: 'A future-facing vocalist blending club production, alternative R&B and intimate songwriting.',
    spotifyUrl: 'https://open.spotify.com/search/Kelela',
    image: '',
  },
  {
    name: 'Loraine James',
    listeners: 198000,
    match: 0.87,
    score: 88,
    sources: ['James Blake'],
    tags: ['electronic', 'experimental', 'ambient'],
    topTracks: ['Let U Go', 'Simple Stuff', 'Glitch Bitch'],
    bio: 'A London producer known for fractured rhythms, tactile synths and emotionally sharp club experiments.',
    spotifyUrl: 'https://open.spotify.com/search/Loraine%20James',
    image: '',
  },
  {
    name: 'serpentwithfeet',
    listeners: 331000,
    match: 0.84,
    score: 85,
    sources: ['Sampha', 'FKA twigs'],
    tags: ['soul', 'experimental', 'r&b'],
    topTracks: ['Fellowship', 'Cherubim', 'Same Size Shoe'],
    bio: 'A dramatic soul artist combining choral textures, queer intimacy and rich electronic production.',
    spotifyUrl: 'https://open.spotify.com/search/serpentwithfeet',
    image: '',
  },
]

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: Search },
  { id: 'artists', label: 'Artists', icon: UserRound },
  { id: 'history', label: 'History', icon: History },
  { id: 'taste', label: 'Taste Lab', icon: BarChart3 },
  { id: 'replay', label: 'Replay 26', icon: Sparkles },
  { id: 'algorithm', label: 'Algorithm', icon: BookOpen },
]

const PLAYLIST_MOODS = {
  cinematic: ['ambient', 'soul', 'experimental'],
  club: ['electronic', 'dance', 'house'],
  study: ['ambient', 'jazz', 'folk'],
  late: ['r&b', 'soul', 'indie'],
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function formatNumber(value) {
  if (!value) return 'unknown'
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function makeSpotifySearch(name) {
  return `https://open.spotify.com/search/${encodeURIComponent(name)}`
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

async function lastfm(method, params) {
  if (!LASTFM_KEY) {
    throw new Error('Missing VITE_LASTFM_KEY in .env')
  }

  const url = new URL(LASTFM_BASE)
  url.searchParams.set('method', method)
  url.searchParams.set('api_key', LASTFM_KEY)
  url.searchParams.set('format', 'json')

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url)
  const data = await response.json()
  if (data.error) {
    throw new Error(data.message || 'Last.fm request failed')
  }
  return data
}

async function getSpotifyArtist(name) {
  const url = new URL('/api/spotify-artist', window.location.origin)
  url.searchParams.set('name', name)

  const response = await fetch(url)

  if (!response.ok) return null
  const data = await response.json()
  return data.artist || null
}

async function enrichArtist(candidate) {
  const [infoResult, tracksResult, spotifyResult] = await Promise.allSettled([
    lastfm('artist.getinfo', { artist: candidate.name, autocorrect: '1' }),
    lastfm('artist.gettoptracks', { artist: candidate.name, limit: '3', autocorrect: '1' }),
    getSpotifyArtist(candidate.name),
  ])

  const info = infoResult.status === 'fulfilled' ? infoResult.value.artist : null
  const tracks = tracksResult.status === 'fulfilled' ? tracksResult.value.toptracks?.track ?? [] : []
  const spotify = spotifyResult.status === 'fulfilled' ? spotifyResult.value : null
  const tags = [
    ...(info?.tags?.tag ?? []).map((tag) => tag.name.toLowerCase()),
    ...(spotify?.spotifyGenres ?? []),
  ]

  return {
    ...candidate,
    listeners: Number(info?.stats?.listeners ?? candidate.listeners ?? 0),
    playcount: Number(info?.stats?.playcount ?? 0),
    tags: [...new Set(tags)].slice(0, 5),
    topTracks: tracks.map((track) => track.name).slice(0, 3),
    bio: info?.bio?.summary?.replace(/<a\b[^>]*>.*?<\/a>/g, '').trim() || candidate.bio || '',
    image: spotify?.image || '',
    spotifyUrl: spotify?.spotifyUrl || makeSpotifySearch(candidate.name),
    spotifyPopularity: spotify?.popularity ?? null,
  }
}

function computeScore({ match, sourceCount, listeners }) {
  const matchScore = Math.round(match * 62)
  const focusScore = sourceCount === 1 ? 20 : sourceCount === 2 ? 14 : 8
  const nicheScore = listeners > 0 ? Math.max(0, Math.round(18 - Math.log10(listeners) * 2.4)) : 9
  return Math.min(99, Math.max(1, matchScore + focusScore + nicheScore))
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(session) {
  const next = [session, ...readHistory()].slice(0, 12)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

function makeSessionId() {
  return crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const [activePage, setActivePage] = useState('discover')
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [results, setResults] = useState(MOCK_ARTISTS)
  const [history, setHistory] = useState(readHistory)
  const [filters, setFilters] = useState({
    tag: 'all',
    maxListeners: 750000,
    minMatch: 20,
    mood: 'late',
  })
  const [selectedArtist, setSelectedArtist] = useState(MOCK_ARTISTS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState([])

  const filteredResults = useMemo(() => {
    const moodTags = PLAYLIST_MOODS[filters.mood] || []
    return results
      .filter((artist) => filters.tag === 'all' || artist.tags.some((tag) => tag.includes(filters.tag)))
      .filter((artist) => !artist.listeners || artist.listeners <= filters.maxListeners)
      .filter((artist) => artist.score >= filters.minMatch)
      .map((artist) => ({
        ...artist,
        moodFit: moodTags.filter((tag) => artist.tags.some((artistTag) => artistTag.includes(tag))).length,
      }))
      .sort((a, b) => b.moodFit - a.moodFit || b.score - a.score)
  }, [filters, results])

  const tasteStats = useMemo(() => {
    const counts = new Map()
    results.forEach((artist) => {
      artist.tags.slice(0, 3).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
    })
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, width: Math.max(14, Math.round((count / Math.max(results.length, 1)) * 100)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [results])

  function updateInput(index, value) {
    setInputs((current) => current.map((item, i) => (i === index ? value : item)))
  }

  function selectArtist(artist) {
    setSelectedArtist(artist)
    setActivePage('artists')
  }

  async function findArtists() {
    const filled = inputs.map((item) => item.trim()).filter(Boolean)
    if (!filled.length) return

    setLoading(true)
    setError('')
    setNotFound([])

    try {
      const responses = await Promise.allSettled(
        filled.map((artist) => lastfm('artist.getsimilar', { artist, limit: '50', autocorrect: '1' }))
      )

      const missed = filled.filter((_, index) => responses[index].status === 'rejected')
      setNotFound(missed)

      const byName = new Map()
      responses.forEach((response, index) => {
        if (response.status !== 'fulfilled') return
        const source = filled[index]
        const list = response.value.similarartists?.artist ?? []
        list.forEach((artist) => {
          if (!artist.name || artist.name.includes(',') || /\s(&|x|and|feat\.?|ft\.?|vs\.?|\+)\s/i.test(artist.name)) return
          const candidateName = normalize(artist.name)
          if (filled.some((input) => candidateName.includes(normalize(input)) || normalize(input).includes(candidateName))) return

          const existing = byName.get(candidateName)
          const match = Number(artist.match || 0)
          if (existing) {
            existing.match = Math.max(existing.match, match)
            existing.sources = [...new Set([...existing.sources, source])]
          } else {
            byName.set(candidateName, { name: artist.name, match, sources: [source] })
          }
        })
      })

      const candidates = [...byName.values()]
        .map((artist) => ({ ...artist, sourceCount: artist.sources.length }))
        .sort((a, b) => b.match - a.match)
        .slice(0, 18)

      const enriched = await Promise.all(candidates.map(enrichArtist))
      const scored = enriched
        .map((artist) => ({
          ...artist,
          score: computeScore({
            match: artist.match,
            sourceCount: artist.sourceCount,
            listeners: artist.listeners,
          }),
        }))
        .filter((artist) => artist.listeners > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)

      setResults(scored)
      setSelectedArtist(scored[0] || null)
      setHistory(
        saveHistory({
          id: makeSessionId(),
          date: new Date().toISOString(),
          inputs: filled,
          resultCount: scored.length,
          topArtist: scored[0]?.name || 'No result',
          dominantTags: scored.flatMap((artist) => artist.tags).slice(0, 6),
        })
      )
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pages = {
    discover: (
      <DiscoverPage
        inputs={inputs}
        updateInput={updateInput}
        findArtists={findArtists}
        loading={loading}
        filters={filters}
        setFilters={setFilters}
        error={error}
        notFound={notFound}
        results={filteredResults}
        selectArtist={selectArtist}
      />
    ),
    artists: <ArtistsPage artists={filteredResults} selectedArtist={selectedArtist} selectArtist={selectArtist} />,
    history: <HistoryPage history={history} setHistory={setHistory} />,
    taste: <TastePage stats={tasteStats} artists={filteredResults} />,
    replay: <ReplayPage artists={filteredResults} history={history} />,
    algorithm: <AlgorithmPage filters={filters} />,
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Disc3 size={24} />
          </div>
          <div>
            <p>Subsurface</p>
            <span>Music Finder Next</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={activePage === item.id ? 'nav-item active' : 'nav-item'}
                type="button"
                onClick={() => setActivePage(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">API Status</span>
          <strong>{LASTFM_KEY ? 'Last.fm ready' : 'Demo mode'}</strong>
          <p>Spotify enrichment is routed through a serverless API so secrets stay off the frontend.</p>
        </div>
      </aside>

      <main className="content">{pages[activePage]}</main>
    </div>
  )
}

function DiscoverPage({ inputs, updateInput, findArtists, loading, filters, setFilters, error, notFound, results, selectArtist }) {
  return (
    <section className="page-grid discover-grid">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="status-pill">
            <Headphones size={15} />
            Last.fm similarity + Spotify artist layer
          </span>
          <h1>A sharper workspace for discovering artists your feed keeps missing.</h1>
          <p>
            Enter three artists you already love. The model combines similarity, listener scale, genre fit and niche depth
            into a more deliberate discovery layer.
          </p>
        </div>

        <div className="search-console">
          <div className="console-header">
            <span>Seed Artists</span>
            <Music2 size={18} />
          </div>
          {inputs.map((value, index) => (
            <label className="artist-input" key={index}>
              <span>0{index + 1}</span>
              <input
                value={value}
                onChange={(event) => updateInput(index, event.target.value)}
                placeholder={['First artist', 'Second artist', 'Third artist'][index]}
              />
            </label>
          ))}
          <button className="primary-action" type="button" onClick={findArtists} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            <span>{loading ? 'Finding matches' : 'Run Discovery'}</span>
          </button>
          {error && <p className="error-text">{error}</p>}
          {notFound.length > 0 && <p className="warning-text">Not found: {notFound.join(', ')}</p>}
        </div>
      </div>

      <FilterPanel filters={filters} setFilters={setFilters} />

      <section className="results-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Hidden Gems</span>
            <h2>{results.length} refined recommendations</h2>
          </div>
          <SlidersHorizontal size={20} />
        </div>

        <div className="artist-card-grid">
          {results.map((artist, index) => (
            <ArtistCard key={artist.name} artist={artist} index={index} onOpen={() => selectArtist(artist)} />
          ))}
        </div>
      </section>
    </section>
  )
}

function FilterPanel({ filters, setFilters }) {
  return (
    <section className="filter-panel">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Filter Stack</span>
          <h2>Control the recommendation lens</h2>
        </div>
        <Filter size={19} />
      </div>

      <div className="chip-row" role="list" aria-label="Genre filters">
        {DISCOVERY_TAGS.map((tag) => (
          <button
            key={tag}
            className={filters.tag === tag ? 'filter-chip active' : 'filter-chip'}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, tag }))}
          >
            {tag}
          </button>
        ))}
      </div>

      <label className="range-control">
        <span>Max listeners: {formatNumber(filters.maxListeners)}</span>
        <input
          type="range"
          min="50000"
          max="2000000"
          step="50000"
          value={filters.maxListeners}
          onChange={(event) => setFilters((current) => ({ ...current, maxListeners: Number(event.target.value) }))}
        />
      </label>

      <label className="range-control">
        <span>Minimum model score: {filters.minMatch}</span>
        <input
          type="range"
          min="1"
          max="99"
          value={filters.minMatch}
          onChange={(event) => setFilters((current) => ({ ...current, minMatch: Number(event.target.value) }))}
        />
      </label>

      <label className="select-control">
        <span>Mood target</span>
        <select
          value={filters.mood}
          onChange={(event) => setFilters((current) => ({ ...current, mood: event.target.value }))}
        >
          <option value="late">Late-night headphones</option>
          <option value="cinematic">Cinematic study</option>
          <option value="club">Smart club energy</option>
          <option value="study">Soft focus</option>
        </select>
      </label>
    </section>
  )
}

function ArtistCard({ artist, index, onOpen }) {
  return (
    <article className="artist-card">
      <button className="artist-art" type="button" onClick={onOpen} title={`Open ${artist.name}`}>
        {artist.image ? <img src={artist.image} alt={`${artist.name} artist portrait`} /> : <span>{getInitials(artist.name)}</span>}
      </button>
      <div className="artist-card-body">
        <div className="card-topline">
          <span>#{index + 1}</span>
          <strong>{artist.score}</strong>
        </div>
        <h3>{artist.name}</h3>
        <p>{formatNumber(artist.listeners)} listeners</p>
        <div className="mini-tags">
          {artist.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="card-actions">
          <button type="button" onClick={onOpen}>
            Details
          </button>
          <a href={artist.spotifyUrl || makeSpotifySearch(artist.name)} target="_blank" rel="noreferrer" title="Open Spotify">
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </article>
  )
}

function ArtistsPage({ artists, selectedArtist, selectArtist }) {
  const artist = selectedArtist || artists[0]

  return (
    <section className="artist-detail-layout">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Artist Intelligence</span>
          <h1>Artist profiles with context, evidence and a clean Spotify handoff.</h1>
        </div>
      </div>

      <div className="artist-strip">
        {artists.map((item) => (
          <button
            className={artist?.name === item.name ? 'artist-strip-item active' : 'artist-strip-item'}
            key={item.name}
            type="button"
            onClick={() => selectArtist(item)}
          >
            {item.image ? <img src={item.image} alt="" /> : <span>{getInitials(item.name)}</span>}
            <strong>{item.name}</strong>
          </button>
        ))}
      </div>

      {artist && (
        <article className="artist-profile">
          <div className="profile-art">
            {artist.image ? <img src={artist.image} alt={`${artist.name} artist portrait`} /> : <span>{getInitials(artist.name)}</span>}
          </div>
          <div className="profile-copy">
            <span className="status-pill">
              <Star size={15} />
              Model score {artist.score}
            </span>
            <h2>{artist.name}</h2>
            <p>{artist.bio || 'Bio unavailable from Last.fm. Spotify and Last.fm metadata will fill this area when API keys are present.'}</p>

            <div className="profile-metrics">
              <Metric label="Listeners" value={formatNumber(artist.listeners)} />
              <Metric label="Match" value={`${Math.round((artist.match || 0) * 100)}%`} />
              <Metric label="Sources" value={artist.sources?.join(', ') || 'demo'} />
            </div>

            <div className="detail-columns">
              <div>
                <h3>Top hits</h3>
                <ol className="track-list">
                  {(artist.topTracks?.length ? artist.topTracks : ['Track data loading from Last.fm']).map((track) => (
                    <li key={track}>{track}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>Belongs to filters</h3>
                <div className="mini-tags large">
                  {artist.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <a className="spotify-link" href={artist.spotifyUrl || makeSpotifySearch(artist.name)} target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              Open Spotify profile
            </a>
          </div>
        </article>
      )}
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function HistoryPage({ history, setHistory }) {
  return (
    <section className="standard-page">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Search Memory</span>
          <h1>Search history designed for return visits and follow-up discovery.</h1>
        </div>
        <button
          className="ghost-action"
          type="button"
          onClick={() => {
            localStorage.removeItem(HISTORY_KEY)
            setHistory([])
          }}
        >
          Clear
        </button>
      </div>

      <div className="history-timeline">
        {history.length === 0 ? (
          <div className="empty-state">
            <Clock3 size={28} />
            <p>Run a discovery search and it will appear here with the top artist and dominant tags.</p>
          </div>
        ) : (
          history.map((session) => (
            <article className="history-item" key={session.id}>
              <span>{new Date(session.date).toLocaleString()}</span>
              <h3>{session.inputs.join(' + ')}</h3>
              <p>
                Top result: <strong>{session.topArtist}</strong> - {session.resultCount} recommendations
              </p>
              <div className="mini-tags">
                {session.dominantTags.map((tag, index) => (
                  <span key={`${session.id}-${tag}-${index}`}>{tag}</span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function TastePage({ stats, artists }) {
  const avgScore = Math.round(artists.reduce((sum, artist) => sum + artist.score, 0) / Math.max(artists.length, 1))
  const avgListeners = Math.round(artists.reduce((sum, artist) => sum + (artist.listeners || 0), 0) / Math.max(artists.length, 1))

  return (
    <section className="analytics-page">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Taste Visualization</span>
          <h1>A compact visual readout of the listener's taste signature.</h1>
        </div>
      </div>

      <div className="analytics-grid">
        <Metric label="Average model score" value={avgScore || 'n/a'} />
        <Metric label="Avg. listener scale" value={formatNumber(avgListeners)} />
        <Metric label="Dominant microgenres" value={stats.length} />
      </div>

      <div className="chart-panel">
        <h2>Genre gravity</h2>
        {stats.map((item) => (
          <div className="bar-row" key={item.tag}>
            <span>{item.tag}</span>
            <div className="bar-track">
              <div style={{ width: `${item.width}%` }} />
            </div>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>

      <div className="insight-grid">
        <InsightCard icon={TrendingUp} title="Exploration level" text="High scores with low listener counts suggest the user is ready for less mainstream discovery." />
        <InsightCard icon={Activity} title="Genre bridge" text="Repeated tags across different seed artists identify cross-genre bridges for playlist strategy." />
        <InsightCard icon={Info} title="Next data upgrade" text="Spotify listening history could turn these static results into a personalized clustering model." />
      </div>
    </section>
  )
}

function InsightCard({ icon: Icon, title, text }) {
  return (
    <article className="insight-card">
      <Icon size={20} />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function ReplayPage({ artists, history }) {
  const topArtist = artists[0]
  const tags = [...new Set(artists.flatMap((artist) => artist.tags))].slice(0, 5)

  return (
    <section className="replay-page">
      <div className="replay-hero">
        <span className="status-pill">
          <Sparkles size={15} />
          Replay 2026 upgraded
        </span>
        <h1>A yearly recap rebuilt as a discovery identity.</h1>
        <p>
          Search sessions become a profile: top discovery lane, niche confidence, artist network and next playlist move.
        </p>
      </div>

      <div className="replay-grid">
        <article>
          <span>Top hidden artist</span>
          <strong>{topArtist?.name || 'Run a search'}</strong>
          <p>{topArtist ? `${formatNumber(topArtist.listeners)} listeners - score ${topArtist.score}` : 'No recommendations yet.'}</p>
        </article>
        <article>
          <span>Discovery sessions</span>
          <strong>{history.length || 1}</strong>
          <p>Stored locally for demo privacy and repeat exploration.</p>
        </article>
        <article>
          <span>Taste fingerprint</span>
          <strong>{tags.slice(0, 2).join(' / ') || 'alternative / electronic'}</strong>
          <p>{tags.join(', ')}</p>
        </article>
      </div>

      <div className="playlist-lane">
        {artists.slice(0, 6).map((artist, index) => (
          <div className="playlist-node" key={artist.name}>
            <span>{index + 1}</span>
            <strong>{artist.name}</strong>
            <p>{artist.tags.slice(0, 2).join(' - ')}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AlgorithmPage({ filters }) {
  return (
    <section className="algorithm-page">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Course Connection</span>
          <h1>Transparent algorithm variables for Big Data, AI and ML discussion.</h1>
        </div>
      </div>

      <div className="formula-card">
        <span>Recommendation Score</span>
        <strong>S = 0.62M + 0.20N + 0.18L + F</strong>
        <p>
          M is Last.fm similarity, N rewards niche source concentration, L adjusts for listener scale, and F is the
          user-controlled filter layer currently set to {filters.tag}, {formatNumber(filters.maxListeners)} max listeners.
        </p>
      </div>

      <div className="algorithm-steps">
        {[
          ['Collect', 'Call Last.fm similar artists for each seed artist.'],
          ['Clean', 'Remove duplicates, typed artists, collaborations and ambiguous combined names.'],
          ['Enrich', 'Fetch listeners, tags, top tracks, biography and Spotify profile data.'],
          ['Score', 'Blend match strength, niche potential and user-selected filters.'],
          ['Explain', 'Display the reason, variables and source artists on each card.'],
        ].map(([title, text], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <table className="variable-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Meaning</th>
            <th>Product impact</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>M</td>
            <td>Similarity match returned by Last.fm.</td>
            <td>Raises artists musically close to the seed set.</td>
          </tr>
          <tr>
            <td>N</td>
            <td>Source concentration across one or two inputs.</td>
            <td>Avoids overly generic artists that match everything.</td>
          </tr>
          <tr>
            <td>L</td>
            <td>Listener-count niche adjustment.</td>
            <td>Pushes under-the-radar artists upward.</td>
          </tr>
          <tr>
            <td>F</td>
            <td>Genre, mood and threshold filters.</td>
            <td>Lets users steer exploration without hiding the model.</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

export default App
