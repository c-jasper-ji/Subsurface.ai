import { useMemo, useState } from 'react'
import {
  BarChart3,
  Clock3,
  ExternalLink,
  Filter,
  History,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import './App.css'

const HISTORY_KEY = 'subsurface-spotify-knn-history'

const DEFAULT_INPUTS = ['', '', '']

const DISCOVERY_TAGS = [
  'all',
  'r&b',
  'soul',
  'electronic',
  'indie',
  'pop',
  'hip hop',
  'ambient',
  'experimental',
]

const MOCK_ARTISTS = [
  {
    id: 'demo-kelela',
    name: 'Kelela',
    followers: 598000,
    listeners: 598000,
    popularity: 52,
    match: 0.91,
    score: 88,
    sources: ['FKA twigs', 'genre match'],
    tags: ['alternative r&b', 'electronic', 'art pop'],
    topTracks: ['Contact', 'Enough for Love', 'Rewind'],
    bio: 'Spotify catalog profile built from artist followers, popularity, genres and top-track network signals.',
    spotifyUrl: 'https://open.spotify.com/search/Kelela',
    image: '',
    cluster: 'Alt R&B / Soul',
    noveltyScore: 0.72,
    genreScore: 0.82,
    popularityFit: 0.86,
  },
  {
    id: 'demo-loraine-james',
    name: 'Loraine James',
    followers: 146000,
    listeners: 146000,
    popularity: 39,
    match: 0.86,
    score: 84,
    sources: ['genre match'],
    tags: ['experimental electronic', 'ambient', 'uk bass'],
    topTracks: ['Simple Stuff', 'Let U Go', 'Glitch Bitch'],
    bio: 'Spotify catalog profile built from artist followers, popularity, genres and top-track network signals.',
    spotifyUrl: 'https://open.spotify.com/search/Loraine%20James',
    image: '',
    cluster: 'Electronic Edge',
    noveltyScore: 0.9,
    genreScore: 0.76,
    popularityFit: 0.74,
  },
  {
    id: 'demo-serpentwithfeet',
    name: 'serpentwithfeet',
    followers: 311000,
    listeners: 311000,
    popularity: 44,
    match: 0.83,
    score: 81,
    sources: ['Sampha', 'genre match'],
    tags: ['indie soul', 'alternative r&b', 'experimental'],
    topTracks: ['Fellowship', 'Cherubim', 'Same Size Shoe'],
    bio: 'Spotify catalog profile built from artist followers, popularity, genres and top-track network signals.',
    spotifyUrl: 'https://open.spotify.com/search/serpentwithfeet',
    image: '',
    cluster: 'Alt R&B / Soul',
    noveltyScore: 0.82,
    genreScore: 0.71,
    popularityFit: 0.8,
  },
]

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: Search },
  { id: 'artists', label: 'Artists', icon: UserRound },
  { id: 'history', label: 'History', icon: History },
  { id: 'taste', label: 'Taste Lab', icon: BarChart3 },
  { id: 'replay', label: "Replay 26'", icon: Sparkles },
]

const PLAYLIST_MOODS = {
  cinematic: ['ambient', 'soul', 'experimental'],
  club: ['electronic', 'dance', 'house'],
  study: ['ambient', 'jazz', 'folk'],
  late: ['r&b', 'soul', 'indie'],
}

function formatNumber(value) {
  if (!value) return 'not available'
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const GENRE_OVERRIDES = {
  'r&b': 'R&B',
  'k-pop': 'K-Pop',
  'lo-fi': 'Lo-Fi',
  edm: 'EDM',
  uk: 'UK',
}

function formatGenre(genre) {
  if (!genre) return ''
  const lower = genre.toLowerCase().trim()
  if (GENRE_OVERRIDES[lower]) return GENRE_OVERRIDES[lower]
  return lower
    .split(' ')
    .map((word) => (GENRE_OVERRIDES[word] ? GENRE_OVERRIDES[word] : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

function audienceValue(artist) {
  return artist.monthlyListeners || artist.listeners || artist.followers || 0
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

async function discoverSpotifyArtists(seedArtists) {
  const url = new URL('/api/discover', window.location.origin)
  url.searchParams.set('artists', seedArtists.join(','))
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Discovery failed')
  }

  return data
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [results, setResults] = useState([])
  const [history, setHistory] = useState(readHistory)
  const [filters, setFilters] = useState({
    tag: 'all',
    maxFollowers: 1500000,
    minMatch: 0,
    mood: 'none',
  })
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState([])

  const filteredResults = useMemo(() => {
    const moodTags = PLAYLIST_MOODS[filters.mood] || []
    return results
      .filter((artist) => filters.tag === 'all' || artist.tags.some((tag) => tag.includes(filters.tag)))
      .filter((artist) => !audienceValue(artist) || audienceValue(artist) <= filters.maxFollowers)
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

  const clusterStats = useMemo(() => {
    const counts = new Map()
    results.forEach((artist) => counts.set(artist.cluster || 'Discovery Cluster', (counts.get(artist.cluster || 'Discovery Cluster') || 0) + 1))
    return [...counts.entries()].map(([cluster, count]) => ({ cluster, count }))
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
      const data = await discoverSpotifyArtists(filled)
      const scored = data.results || []
      const missed = filled.filter(
        (name) => !(data.seeds || []).some((seed) => seed.name.toLowerCase() === name.toLowerCase())
      )

      setNotFound(missed)
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
          results: scored.slice(0, 12),
          seeds: data.seeds || [],
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
    history: <HistoryPage history={history} setHistory={setHistory} setSelectedSession={setSelectedSession} />,
    taste: <TastePage stats={tasteStats} clusterStats={clusterStats} artists={filteredResults} />,
    replay: <ReplayPage artists={filteredResults} history={history} />,
  }

  return (
    <div className="app-shell">
      <header className="site-chrome" aria-label="Site navigation">
        <button
          className={menuOpen ? 'chrome-toggle active' : 'chrome-toggle'}
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
        >
          <span />
        </button>
        <div className="top-wordmark brand-label" aria-label="Subsurface Music Discovery">
          <p>SUBSURFACE</p>
          <span>Music Discovery</span>
        </div>
      </header>

      <button
        className={menuOpen ? 'nav-scrim open' : 'nav-scrim'}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={menuOpen ? 'liquid-menu open' : 'liquid-menu'} aria-hidden={!menuOpen}>
        <div className="drawer-brand brand-label">
          <p>SUBSURFACE</p>
          <span>Discovery Index</span>
        </div>

        <nav className="liquid-nav-list" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={activePage === item.id ? 'liquid-nav-item active' : 'liquid-nav-item'}
                type="button"
                onClick={() => {
                  setActivePage(item.id)
                  setMenuOpen(false)
                }}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="content page-fade" key={activePage}>
        {pages[activePage]}
      </main>

      {selectedSession && <HistoryModal session={selectedSession} onClose={() => setSelectedSession(null)} />}
    </div>
  )
}

function DiscoverPage({ inputs, updateInput, findArtists, loading, filters, setFilters, error, notFound, results, selectArtist }) {
  return (
    <section className="page-grid discover-grid">
      <div className="hero-panel immersive-panel">
        <div className="hero-copy">
          <span className="status-pill">Spotify catalog model</span>
          <h1>Find the artists Spotify keeps just below the surface.</h1>
          <p>
            Enter three names. Subsurface compares listener scale, popularity, genres and track networks, then returns a
            tighter set of nearby artists.
          </p>
        </div>

        <div className="search-console glass-panel">
          <div className="console-header">
            <span>Seed Artists</span>
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
            {loading && <Loader2 className="spin" size={18} />}
            <span>{loading ? 'Building Spotify vectors' : 'Run Discovery'}</span>
          </button>
          {error && <p className="error-text">{error}</p>}
          {notFound.length > 0 && <p className="warning-text">Could not map exactly: {notFound.join(', ')}</p>}
        </div>
      </div>

      <FilterPanel filters={filters} setFilters={setFilters} />

      <section className="results-panel glass-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Discoveries</span>
            <h2>{results.length} Hidden Gems Found</h2>
          </div>
          <SlidersHorizontal size={20} />
        </div>

        <div className="artist-card-grid">
          {results.map((artist, index) => (
            <ArtistCard key={artist.id || artist.name} artist={artist} index={index} onOpen={() => selectArtist(artist)} />
          ))}
        </div>
      </section>
    </section>
  )
}

function FilterPanel({ filters, setFilters }) {
  return (
    <section className="filter-panel glass-panel">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Filter Stack</span>
          <h2>Shape the neighbor search</h2>
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
        <span>Max monthly listeners: {formatNumber(filters.maxFollowers)}</span>
        <input
          type="range"
          min="50000"
          max="1500000"
          step="50000"
          value={filters.maxFollowers}
          onChange={(event) => setFilters((current) => ({ ...current, maxFollowers: Number(event.target.value) }))}
        />
      </label>

      <label className="range-control">
        <span>Minimum match score: {filters.minMatch}</span>
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
          <option value="none">No mood filter</option>
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
    <article className="artist-card glass-panel">
      <button className="artist-art" type="button" onClick={onOpen} title={`Open ${artist.name}`}>
        {artist.image ? <img src={artist.image} alt={`${artist.name} artist portrait`} /> : <span>{getInitials(artist.name)}</span>}
      </button>
      <div className="artist-card-body">
        <div className="card-topline">
          <span>#{index + 1} - {artist.cluster}</span>
          <strong>{artist.score}</strong>
        </div>
        <h3>{artist.name}</h3>
        <p>{formatNumber(audienceValue(artist))} listeners</p>
        <div className="mini-tags">
          {artist.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{formatGenre(tag)}</span>
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
  const neighborArtists = artists.filter((item) => item.name !== artist?.name).slice(0, 5)
  const signalRows = artist
    ? [
        { label: 'Genre fit', value: Math.round((artist.genreScore || 0) * 100) },
        { label: 'Novelty', value: Math.round((artist.noveltyScore || 0) * 100) },
        { label: 'Popularity fit', value: Math.round((artist.popularityFit || 0) * 100) },
      ]
    : []

  return (
    <section className="artist-detail-layout glass-page">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Artist Intelligence</span>
          <h1>A fuller read on each recommendation.</h1>
        </div>
      </div>

      {artist && (
        <div className="artist-workspace">
          <article className="artist-profile glass-panel">
            <div className="profile-art">
              {artist.image ? <img src={artist.image} alt={`${artist.name} artist portrait`} /> : <span>{getInitials(artist.name)}</span>}
            </div>
            <div className="profile-copy">
              <span className="status-pill">Match {artist.score} - {artist.cluster}</span>
              <h2>{artist.name}</h2>
              <p>{artist.bio}</p>

              <div className="profile-metrics">
                <Metric label="Monthly listeners" value={formatNumber(audienceValue(artist))} />
                <Metric label="Popularity" value={artist.popularity ?? 'scored'} />
                <Metric label="Similarity" value={`${Math.round((artist.match || 0) * 100)}%`} />
              </div>

              <div className="detail-columns">
                <div>
                  <h3>Top tracks</h3>
                  <ol className="track-list">
                    {(artist.topTracks?.length ? artist.topTracks : ['Spotify track data loading']).map((track) => (
                      <li key={track}>{track}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3>Feature tags</h3>
                  <div className="mini-tags large">
                    {artist.tags.map((tag) => (
                      <span key={tag}>{formatGenre(tag)}</span>
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

          <aside className="artist-side-panel glass-panel">
            <span className="eyebrow">Recommendation Queue</span>
            <h2>Nearby artists</h2>
            <div className="side-list">
              {neighborArtists.map((item, index) => (
                <button key={item.id || item.name} type="button" onClick={() => selectArtist(item)}>
                  {item.image ? <img src={item.image} alt="" /> : <span>{getInitials(item.name)}</span>}
                  <div>
                    <strong>{item.name}</strong>
                    <small>#{index + 2} - score {item.score}</small>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {artist && (
        <div className="artist-signal-grid">
          <section className="signal-card glass-panel">
            <span className="eyebrow">Signal Mix</span>
            <h2>Why this artist surfaced</h2>
            <div className="signal-bars">
              {signalRows.map((row) => (
                <div className="signal-row" key={row.label}>
                  <div>
                    <span>{row.label}</span>
                    <strong>{row.value}%</strong>
                  </div>
                  <div className="bar-track">
                    <div style={{ width: `${Math.max(6, row.value)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="signal-card glass-panel">
            <span className="eyebrow">Source Links</span>
            <h2>Connection trail</h2>
            <div className="mini-tags large">
              {(artist.sources?.length ? artist.sources : ['Spotify recommendation']).map((source) => (
                <span key={source}>{source}</span>
              ))}
            </div>
          </section>
        </div>
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

function HistoryPage({ history, setHistory, setSelectedSession }) {
  return (
    <section className="standard-page glass-page">
      <div className="section-heading wide history-heading">
        <div>
          <span className="eyebrow">Search Memory</span>
          <h1>Saved sessions with recommendation detail.</h1>
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
            <p>Run a Spotify discovery search and the session will appear here.</p>
          </div>
        ) : (
          history.map((session) => (
            <button className="history-item glass-panel" key={session.id} type="button" onClick={() => setSelectedSession(session)}>
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
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function HistoryModal({ session, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="history-modal glass-panel" role="dialog" aria-modal="true" aria-label="Recommendation session details" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Session Detail</span>
            <h2>{session.inputs.join(' + ')}</h2>
            <p>{new Date(session.date).toLocaleString()} - {session.resultCount} recommendations</p>
          </div>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close session detail">
            <X size={18} />
          </button>
        </div>
        <div className="modal-results">
          {(session.results || []).map((artist, index) => (
            <article key={artist.id || artist.name}>
              <span>{index + 1}</span>
              <div>
                <strong>{artist.name}</strong>
                <p>{formatNumber(audienceValue(artist))} monthly listeners - score {artist.score} - {artist.cluster}</p>
              </div>
              <a href={artist.spotifyUrl || makeSpotifySearch(artist.name)} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function TastePage({ stats, clusterStats, artists }) {
  const avgScore = Math.round(artists.reduce((sum, artist) => sum + artist.score, 0) / Math.max(artists.length, 1))
  const avgFollowers = Math.round(artists.reduce((sum, artist) => sum + audienceValue(artist), 0) / Math.max(artists.length, 1))
  const avgPopularity = Math.round(artists.reduce((sum, artist) => sum + (artist.popularity || 0), 0) / Math.max(artists.length, 1))

  return (
    <section className="analytics-page glass-page">
      <div className="section-heading wide">
        <div>
          <span className="eyebrow">Taste Lab</span>
          <h1>Genre gravity and cluster readout from Spotify vectors.</h1>
        </div>
      </div>

      <div className="analytics-grid">
        <Metric label="Average match score" value={avgScore || 'n/a'} />
        <Metric label="Avg. monthly listeners" value={formatNumber(avgFollowers)} />
        <Metric label="Avg. popularity" value={avgPopularity || 'scored'} />
      </div>

      <div className="chart-panel glass-panel">
        <h2>Genre gravity</h2>
        {stats.map((item) => (
          <div className="bar-row" key={item.tag}>
            <span>{formatGenre(item.tag)}</span>
            <div className="bar-track">
              <div style={{ width: `${item.width}%` }} />
            </div>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>

      <div className="insight-grid">
        {clusterStats.map((item) => (
          <article className="insight-card glass-panel" key={item.cluster}>
            <h3>{item.cluster}</h3>
            <p>{item.count} recommended artists sit in this taste cluster.</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ReplayPage({ artists, history }) {
  const topArtist = artists[0]
  const tags = [...new Set(artists.flatMap((artist) => artist.tags))].slice(0, 5)
  const clusters = [...new Set(artists.map((artist) => artist.cluster))].slice(0, 3)

  return (
    <section className="replay-page glass-page">
      <div className="replay-hero immersive-panel">
        <span className="status-pill">Replay 26'</span>
        <h1>Your discovery identity, rebuilt from Spotify signals.</h1>
        <p>
          A compact readout of top neighbor, taste cluster and playlist direction based on followers, genres and top-track networks.
        </p>
      </div>

      <div className="replay-grid condensed-grid">
        <article className="glass-panel">
          <span>Top neighbor</span>
          <strong>{topArtist?.name || 'Run a search'}</strong>
          <p>{topArtist ? `${formatNumber(audienceValue(topArtist))} monthly listeners - score ${topArtist.score}` : 'No recommendations yet.'}</p>
        </article>
        <article className="glass-panel">
          <span>Sessions</span>
          <strong>{history.length || 1}</strong>
          <p>Local session memory for replay and comparison.</p>
        </article>
        <article className="glass-panel">
          <span>Taste fingerprint</span>
          <strong>{tags.slice(0, 2).join(' / ') || 'alt r&b / electronic'}</strong>
          <p>{clusters.join(', ')}</p>
        </article>
      </div>

      <div className="playlist-lane compact-lane glass-panel">
        {artists.slice(0, 6).map((artist, index) => (
          <div className="playlist-node" key={artist.id || artist.name}>
            <span>{index + 1}</span>
            <strong>{artist.name}</strong>
            <p>{artist.cluster}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default App
