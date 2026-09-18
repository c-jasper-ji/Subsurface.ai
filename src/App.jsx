import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  ExternalLink,
  Gauge,
  Headphones,
  History,
  Layers3,
  Loader2,
  Menu,
  Music2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'

const HISTORY_KEY = 'subsurface-discovery-history-v2'
const DEFAULT_INPUTS = ['FKA twigs', 'James Blake', 'Sampha']
const DISCOVERY_TAGS = ['all', 'r&b', 'soul', 'electronic', 'indie', 'pop', 'hip hop', 'ambient', 'experimental']

const DEMO_ARTISTS = [
  {
    id: 'demo-kelela',
    name: 'Kelela',
    image: 'https://i.scdn.co/image/ab6761610000517483ffae7fe0242c07cc55adbb',
    score: 94,
    match: 0.91,
    listeners: 598000,
    tags: ['electronic', 'r&b', 'breakbeat'],
    topTracks: ['Contact', 'Rewind', 'Happy Ending'],
    spotifyUrl: 'https://open.spotify.com/artist/1U0sIzpRtDkvu1hXXzxh60',
    cluster: 'Alt R&B / Soul',
    sources: ['FKA twigs', 'Sampha'],
    reason: 'Strong overlap with FKA twigs and Sampha, with room to explore.',
    signals: { relevance: 94, discovery: 72, consensus: 67, confidence: 100 },
  },
  {
    id: 'demo-dijon',
    name: 'Dijon',
    image: 'https://i.scdn.co/image/ab6761610000517473479e6db034c4a43d4aee04',
    score: 90,
    match: 0.88,
    listeners: 836000,
    tags: ['neo-soul', 'alternative r&b', 'r&b'],
    topTracks: ['The Dress', 'Skin', 'Talk Down'],
    spotifyUrl: 'https://open.spotify.com/artist/0knGpCTbmG4ctl1wzYRZs4',
    cluster: 'Alt R&B / Soul',
    sources: ['Sampha', 'James Blake'],
    reason: 'Shared soulful production cues across two of your seeds.',
    signals: { relevance: 91, discovery: 63, consensus: 67, confidence: 100 },
  },
  {
    id: 'demo-nxworries',
    name: 'NxWorries',
    image: 'https://i.scdn.co/image/ab6761610000517489fa062521347470d69ba4c2',
    score: 87,
    match: 0.84,
    listeners: 726000,
    tags: ['soul', 'hip hop', 'neo-soul'],
    topTracks: ['Suede', 'Where I Go', 'Daydreaming'],
    spotifyUrl: 'https://open.spotify.com/artist/6PEMFpe3PTOksdV4ZXUpbE',
    cluster: 'Rap Adjacent',
    sources: ['Sampha'],
    reason: 'A rhythmic branch from the same soul-led taste space.',
    signals: { relevance: 86, discovery: 69, consensus: 33, confidence: 100 },
  },
  {
    id: 'demo-smino',
    name: 'Smino',
    image: 'https://i.scdn.co/image/ab676161000051744942e4dee1baf077fe6a9e2c',
    score: 84,
    match: 0.82,
    listeners: 1190000,
    tags: ['rap', 'hip hop', 'r&b'],
    topTracks: ['Wild Irish Roses', "No L's", 'Amphetamine'],
    spotifyUrl: 'https://open.spotify.com/artist/1ybINI1qPiFbwDXamRtwxD',
    cluster: 'Rap Adjacent',
    sources: ['Sampha'],
    reason: 'A high-relevance edge case that widens the result mix.',
    signals: { relevance: 84, discovery: 52, consensus: 33, confidence: 100 },
  },
  {
    id: 'demo-mount-kimbie',
    name: 'Mount Kimbie',
    image: 'https://i.scdn.co/image/ab67616100005174bd861e99a069e3a054c58fa7',
    score: 82,
    match: 0.79,
    listeners: 625000,
    tags: ['dubstep', 'ambient', 'electronic'],
    topTracks: ['Carbonated', 'Before I Move Off', 'Blue Train Lines'],
    spotifyUrl: 'https://open.spotify.com/artist/3NUtpWpGDoffm3RCGhSHtl',
    cluster: 'Electronic Edge',
    sources: ['James Blake'],
    reason: 'An electronic neighbor with strong track-level context.',
    signals: { relevance: 81, discovery: 71, consensus: 33, confidence: 100 },
  },
  {
    id: 'demo-jamie-xx',
    name: 'Jamie xx',
    image: 'https://i.scdn.co/image/ab676161000051745b2ba819fa89b17d6ae81567',
    score: 79,
    match: 0.78,
    listeners: 1420000,
    tags: ['electronic', 'future garage', 'dance'],
    topTracks: ['Loud Places', "I Know There's Gonna Be", 'Gosh'],
    spotifyUrl: 'https://open.spotify.com/artist/7A0awCXkE1FtSU8B0qwOJQ',
    cluster: 'Electronic Edge',
    sources: ['James Blake'],
    reason: 'A familiar bridge into the electronic side of your inputs.',
    signals: { relevance: 78, discovery: 42, consensus: 33, confidence: 100 },
  },
  {
    id: 'demo-jamie-woon',
    name: 'Jamie Woon',
    image: 'https://i.scdn.co/image/ab67616100005174a5d6cd6420f02e1fc2e8a217',
    score: 77,
    match: 0.74,
    listeners: 284000,
    tags: ['soul', 'dubstep', 'electronic'],
    topTracks: ['Night Air', 'Lady Luck', 'Shoulda'],
    spotifyUrl: 'https://open.spotify.com/artist/1fUMEn4Yk7ZUloozE0fRLL',
    cluster: 'Electronic Edge',
    sources: ['James Blake'],
    reason: 'Lower listener scale with a clean genre connection.',
    signals: { relevance: 74, discovery: 84, consensus: 33, confidence: 100 },
  },
  {
    id: 'demo-lianne',
    name: 'Lianne La Havas',
    image: 'https://i.scdn.co/image/ab67616100005174766f6c7b0ba3d0e7e078ce39',
    score: 75,
    match: 0.71,
    listeners: 992000,
    tags: ['soul', 'british', 'singer-songwriter'],
    topTracks: ['Green & Gold', 'Paper Thin', "Can't Fight"],
    spotifyUrl: 'https://open.spotify.com/artist/2RP4pPHTXlQpDnO9LvR7Yt',
    cluster: 'Alt R&B / Soul',
    sources: ['Sampha'],
    reason: 'A vocal-led contrast that keeps the set from collapsing into one sound.',
    signals: { relevance: 72, discovery: 58, consensus: 33, confidence: 100 },
  },
]

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Compass },
  { id: 'discover', label: 'Discover', icon: Search },
  { id: 'results', label: 'Results', icon: Headphones },
  { id: 'library', label: 'Library', icon: History },
]

const GENRE_OVERRIDES = { 'r&b': 'R&B', rnb: 'R&B', 'hip hop': 'Hip-Hop', 'neo-soul': 'Neo-Soul' }

function formatGenre(genre) {
  const normalized = String(genre || '').trim().toLowerCase()
  if (GENRE_OVERRIDES[normalized]) return GENRE_OVERRIDES[normalized]
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatNumber(value) {
  if (!value) return 'Not available'
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(session) {
  const next = [session, ...readHistory().filter((item) => item.inputs.join('|') !== session.inputs.join('|'))].slice(0, 8)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

function makeSessionId() {
  return crypto?.randomUUID?.() || 'session-' + Date.now()
}

async function discoverArtists(seedArtists) {
  const url = new URL('/api/discover', window.location.origin)
  url.searchParams.set('artists', seedArtists.join(','))
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Discovery failed')
  return data
}

function audienceValue(artist) {
  return artist.listeners || artist.monthlyListeners || artist.followers || 0
}

function App() {
  const cachedHistory = useMemo(() => readHistory(), [])
  const cachedResults = cachedHistory[0]?.results?.length ? cachedHistory[0].results : DEMO_ARTISTS
  const [inputs, setInputs] = useState(cachedHistory[0]?.inputs || DEFAULT_INPUTS)
  const [results, setResults] = useState(cachedResults)
  const [history, setHistory] = useState(cachedHistory)
  const [selectedArtist, setSelectedArtist] = useState(cachedResults[0])
  const [hasSearched, setHasSearched] = useState(Boolean(cachedHistory.length))
  const [activeSection, setActiveSection] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState([])
  const [filters, setFilters] = useState({ tag: 'all', maxListeners: 1500000, minScore: 0 })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-18% 0px -55%', threshold: [0.1, 0.35, 0.6] }
    )
    NAV_ITEMS.forEach((item) => {
      const section = document.getElementById(item.id)
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      document.documentElement.style.setProperty('--scroll-shift', Math.round(window.scrollY * -0.035) + 'px')
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const filteredResults = useMemo(
    () =>
      results.filter((artist) => {
        const tagMatch = filters.tag === 'all' || (artist.tags || []).some((tag) => tag.toLowerCase().includes(filters.tag))
        const audienceMatch = !audienceValue(artist) || audienceValue(artist) <= filters.maxListeners
        return tagMatch && audienceMatch && (artist.score || 0) >= filters.minScore
      }),
    [filters, results]
  )

  const heroArtists = useMemo(() => {
    const seen = new Set()
    return [...results, ...DEMO_ARTISTS]
      .filter((artist) => artist.image && !seen.has(artist.name.toLowerCase()) && seen.add(artist.name.toLowerCase()))
      .slice(0, 8)
  }, [results])

  const tasteStats = useMemo(() => {
    const counts = new Map()
    results.forEach((artist) => (artist.tags || []).slice(0, 3).forEach((tag) => counts.set(formatGenre(tag), (counts.get(formatGenre(tag)) || 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [results])

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  function updateInput(index, value) {
    setInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function openArtist(artist) {
    setSelectedArtist(artist)
    window.requestAnimationFrame(() => document.getElementById('artist-detail')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function findArtists(event) {
    event?.preventDefault()
    const filled = inputs.map((item) => item.trim()).filter(Boolean)
    if (!filled.length) {
      setError('Add at least one artist to begin.')
      return
    }
    setLoading(true)
    setError('')
    setNotFound([])
    try {
      const data = await discoverArtists(filled)
      const discovered = data.results || []
      const missed = filled.filter((name) => !(data.seeds || []).some((seed) => seed.name.toLowerCase() === name.toLowerCase()))
      setNotFound(missed)
      setResults(discovered)
      setSelectedArtist(discovered[0] || null)
      setHasSearched(true)
      const session = {
        id: makeSessionId(),
        date: new Date().toISOString(),
        inputs: filled,
        resultCount: discovered.length,
        topArtist: discovered[0]?.name || 'No result',
        results: discovered.slice(0, 16),
        model: data.model,
      }
      setHistory(saveHistory(session))
      window.requestAnimationFrame(() => scrollToSection('results'))
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function reopenSession(session) {
    setInputs(session.inputs)
    setResults(session.results || [])
    setSelectedArtist(session.results?.[0] || null)
    setHasSearched(true)
    window.requestAnimationFrame(() => scrollToSection('results'))
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  return (
    <div className="app-shell">
      <div className="ambient-line" aria-hidden="true" />

      <button className="mobile-menu" type="button" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle navigation">
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={menuOpen ? 'side-nav open' : 'side-nav'}>
        <button className="wordmark" type="button" onClick={() => scrollToSection('home')} aria-label="Subsurface home">
          <span className="wordmark-mark">S</span>
          <span>SUBSURFACE</span>
        </button>
        <nav aria-label="Page sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={activeSection === item.id ? 'nav-link active' : 'nav-link'}
                onClick={() => scrollToSection(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="nav-foot">
          <span>DISCOVERY ENGINE</span>
          <strong>MODEL 02</strong>
        </div>
      </aside>

      <main>
        <section className="page-section hero-section" id="home">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> Music discovery beyond the obvious</span>
            <h1>Your taste has a deeper layer.</h1>
            <p>Start with artists you already love. Subsurface maps the overlap, then deliberately moves one step away from the mainstream.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => scrollToSection('discover')}>
                Start a discovery <ArrowDown size={17} />
              </button>
              <span>{hasSearched ? 'Showing your latest search' : 'Showing a live example set'}</span>
            </div>
          </div>

          <div className="artist-mosaic" aria-label="Artists from the latest discovery">
            {heroArtists.map((artist, index) => (
              <button
                className={'mosaic-tile tile-' + (index + 1)}
                type="button"
                key={artist.id || artist.name}
                onClick={() => openArtist(artist)}
                aria-label={'Open ' + artist.name}
              >
                <img src={artist.image} alt={artist.name} />
                <span>{artist.name}</span>
              </button>
            ))}
          </div>
          <div className="section-index">01 / 04</div>
        </section>

        <section className="page-section discover-section" id="discover">
          <div className="section-intro">
            <span className="eyebrow"><Search size={14} /> Build your starting point</span>
            <h2>Three artists in. A more useful direction out.</h2>
            <p>Use one to three seeds. Three gives the model enough contrast to find both consensus and productive surprises.</p>
          </div>

          <div className="search-stage glass-panel">
            <form onSubmit={findArtists}>
              <div className="seed-grid">
                {inputs.map((value, index) => (
                  <label className="seed-field" key={index}>
                    <span>SEED 0{index + 1}</span>
                    <input value={value} onChange={(event) => updateInput(index, event.target.value)} placeholder="Artist name" />
                  </label>
                ))}
              </div>
              <button className="search-button" type="submit" disabled={loading}>
                {loading ? <Loader2 className="spin" size={19} /> : <Compass size={19} />}
                {loading ? 'Mapping your taste…' : 'Find my next artists'}
              </button>
            </form>

            {error && <p className="status-message error">{error}</p>}
            {notFound.length > 0 && <p className="status-message">Could not match exactly: {notFound.join(', ')}</p>}

            <div className="mechanism-row" aria-label="How the recommendation works">
              <div><span>01</span><strong>Similarity</strong><p>Listening-led neighbors from each seed.</p></div>
              <ChevronRight size={18} />
              <div><span>02</span><strong>Discovery fit</strong><p>Balances relevance with listener scale.</p></div>
              <ChevronRight size={18} />
              <div><span>03</span><strong>Diversity pass</strong><p>Prevents one cluster taking over.</p></div>
            </div>
          </div>

          <div className="filter-strip">
            <div className="filter-title"><SlidersHorizontal size={17} /><span>Refine results</span></div>
            <label>
              <span>Genre</span>
              <select value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}>
                {DISCOVERY_TAGS.map((tag) => <option value={tag} key={tag}>{formatGenre(tag)}</option>)}
              </select>
            </label>
            <label>
              <span>Max Last.fm listeners · {formatNumber(filters.maxListeners)}</span>
              <input type="range" min="100000" max="1500000" step="100000" value={filters.maxListeners} onChange={(event) => setFilters((current) => ({ ...current, maxListeners: Number(event.target.value) }))} />
            </label>
            <label>
              <span>Minimum fit · {filters.minScore}</span>
              <input type="range" min="0" max="90" step="5" value={filters.minScore} onChange={(event) => setFilters((current) => ({ ...current, minScore: Number(event.target.value) }))} />
            </label>
          </div>
          <div className="section-index">02 / 04</div>
        </section>

        <section className="page-section results-section" id="results">
          <div className="results-heading">
            <div>
              <span className="eyebrow"><Headphones size={14} /> Your discovery set</span>
              <h2>{filteredResults.length} artists worth a closer listen.</h2>
            </div>
            <p>{hasSearched ? 'Ranked from your latest search.' : 'Example set from FKA twigs, James Blake and Sampha.'} Select an artist to see the evidence.</p>
          </div>

          <div className="results-workspace">
            <div className="result-list">
              {filteredResults.length ? filteredResults.map((artist, index) => (
                <ArtistResult key={artist.id || artist.name} artist={artist} index={index} active={selectedArtist?.name === artist.name} onOpen={() => openArtist(artist)} />
              )) : (
                <div className="empty-state"><Music2 size={24} /><strong>No artists match these filters.</strong><span>Widen the listener or fit range.</span></div>
              )}
            </div>
            <ArtistDetail artist={selectedArtist} />
          </div>
          <div className="section-index">03 / 04</div>
        </section>

        <section className="page-section library-section" id="library">
          <div className="section-intro library-intro">
            <span className="eyebrow"><Layers3 size={14} /> Continue the thread</span>
            <h2>Your history, taste pattern and next queue—together.</h2>
          </div>

          <div className="library-grid">
            <section className="library-panel history-panel">
              <div className="panel-heading">
                <div><Clock3 size={18} /><h3>Recent searches</h3></div>
                {history.length > 0 && <button type="button" onClick={clearHistory}>Clear</button>}
              </div>
              <div className="history-list">
                {history.length ? history.map((session) => (
                  <button type="button" key={session.id} onClick={() => reopenSession(session)}>
                    <div><strong>{session.inputs.join(' · ')}</strong><span>{new Date(session.date).toLocaleDateString()} · {session.resultCount} results</span></div>
                    <ChevronRight size={17} />
                  </button>
                )) : <p className="quiet-copy">Your searches will stay here on this device.</p>}
              </div>
            </section>

            <section className="library-panel taste-panel">
              <div className="panel-heading"><div><Gauge size={18} /><h3>Taste signal</h3></div></div>
              <div className="taste-stack">
                {tasteStats.map(([tag, count], index) => (
                  <div className="taste-row" key={tag}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{tag}</strong>
                    <div><i style={{ width: Math.max(18, (count / Math.max(results.length, 1)) * 100) + '%' }} /></div>
                    <em>{count}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="library-panel queue-panel">
              <div className="panel-heading"><div><Sparkles size={18} /><h3>Next queue</h3></div></div>
              <div className="queue-list">
                {filteredResults.slice(0, 5).map((artist, index) => (
                  <button type="button" key={artist.id || artist.name} onClick={() => openArtist(artist)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <img src={artist.image} alt="" />
                    <div><strong>{artist.name}</strong><small>{artist.cluster || 'Discovery cluster'}</small></div>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>

            <section className="library-panel model-panel">
              <span className="model-label">MODEL 02</span>
              <h3>Research you can inspect.</h3>
              <p>The score is a weighted decision aid—not a claim that taste is objective. Open any result to see relevance, discovery, consensus and data confidence separately.</p>
              <div className="model-checks">
                <span><Check size={14} /> Last.fm similarity</span>
                <span><Check size={14} /> Spotify enrichment</span>
                <span><Check size={14} /> Cluster diversity</span>
              </div>
            </section>
          </div>

          <footer>
            <span>SUBSURFACE / MUSIC DISCOVERY</span>
            <button type="button" onClick={() => scrollToSection('home')}>Back to top <ArrowUpRight size={15} /></button>
          </footer>
          <div className="section-index">04 / 04</div>
        </section>
      </main>
    </div>
  )
}

function ArtistResult({ artist, index, active, onOpen }) {
  return (
    <article className={active ? 'result-card active' : 'result-card'}>
      <button type="button" onClick={onOpen}>
        <span className="result-rank">{String(index + 1).padStart(2, '0')}</span>
        <div className="result-image">{artist.image ? <img src={artist.image} alt={artist.name} /> : <Music2 size={22} />}</div>
        <div className="result-copy">
          <h3>{artist.name}</h3>
          <p>{artist.reason || 'Connected through ' + (artist.sources || []).join(' and ') + '.'}</p>
          <div className="tag-row">{(artist.tags || []).slice(0, 3).map((tag) => <span key={tag}>{formatGenre(tag)}</span>)}</div>
        </div>
        <div className="fit-score"><strong>{artist.score}</strong><span>FIT</span></div>
      </button>
    </article>
  )
}

function ArtistDetail({ artist }) {
  if (!artist) return <aside className="artist-detail empty-state" id="artist-detail"><Music2 size={24} /><strong>Select an artist</strong></aside>
  const signals = artist.signals || {
    relevance: Math.round((artist.match || artist.score / 100) * 100),
    discovery: Math.max(20, 100 - Math.round((audienceValue(artist) / 1500000) * 70)),
    consensus: Math.min(100, (artist.sources?.length || 1) * 33),
    confidence: (artist.tags?.length || 0) && (artist.topTracks?.length || 0) ? 100 : 60,
  }
  return (
    <aside className="artist-detail" id="artist-detail">
      <div className="detail-portrait">{artist.image ? <img src={artist.image} alt={artist.name} /> : <Music2 size={36} />}</div>
      <div className="detail-header">
        <span className="eyebrow">Selected artist</span>
        <h3>{artist.name}</h3>
        <p>{artist.reason || 'Recommended from the overlap between ' + (artist.sources || []).join(', ') + '.'}</p>
      </div>
      <div className="detail-meta">
        <div><span>Last.fm listeners</span><strong>{formatNumber(audienceValue(artist))}</strong></div>
        <div><span>Cluster</span><strong>{artist.cluster || 'Discovery'}</strong></div>
      </div>
      <div className="signal-list">
        {Object.entries(signals).map(([label, value]) => (
          <div className="signal-row" key={label}>
            <div><span>{formatGenre(label)}</span><strong>{value}</strong></div>
            <div className="signal-track"><i style={{ width: Math.max(2, value) + '%' }} /></div>
          </div>
        ))}
      </div>
      <div className="track-list">
        <span>Start with</span>
        {(artist.topTracks || []).slice(0, 3).map((track, index) => <p key={track}><b>{String(index + 1).padStart(2, '0')}</b>{track}</p>)}
      </div>
      <a className="spotify-link" href={artist.spotifyUrl || 'https://open.spotify.com/search/' + encodeURIComponent(artist.name)} target="_blank" rel="noreferrer">
        Open on Spotify <ExternalLink size={16} />
      </a>
    </aside>
  )
}

export default App
