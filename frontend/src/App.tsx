import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, Bookmark, CalendarDays, ChevronDown, CircleHelp, Clapperboard, Compass, Dna, Film, Flame, Heart, Home, Layers3, Menu, Moon, Plus, Search, Settings2, Sparkles, Star, Sun, Users, X } from 'lucide-react';
import AuthDialog from './components/AuthDialog';
import CommunityFeed from './components/CommunityFeed';
import LibraryPage from './components/LibraryPage';
import MovieDnaPage from './components/MovieDnaPage';
import SchedulePage from './components/SchedulePage';
import MovieDetailDialog from './components/MovieDetailDialog';
import { discoverMovies, getHotstarMovies, getMovieSchedule, searchMovies } from './services/movies';
import { getMyWatchlist, saveWatchlist } from './services/movieActions';
import { supabase } from './lib/supabase';
import type { Movie } from './types/movie';

const imageBase = 'https://image.tmdb.org/t/p/w500';

function App() {
  const [search, setSearch] = useState('');
  const [activeNav, setActiveNav] = useState('For you');
  const [mobileNav, setMobileNav] = useState(false);
  const [lightMode, setLightMode] = useState(() => window.localStorage.getItem('afterscene-theme') === 'light');
  useEffect(() => { document.documentElement.dataset.theme = lightMode ? 'light' : 'dark'; window.localStorage.setItem('afterscene-theme', lightMode ? 'light' : 'dark'); }, [lightMode]);
  const [toast, setToast] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const queryClient = useQueryClient();
  const trending = useQuery({ queryKey: ['movies', 'trending'], queryFn: ({ signal }) => discoverMovies(signal), enabled: Boolean(userId && !search.trim()) });
  const results = useQuery({ queryKey: ['movies', 'search', search], queryFn: ({ signal }) => searchMovies(search.trim(), signal), enabled: Boolean(userId && search.trim().length >= 2) });
  const watchlist = useQuery({ queryKey: ['my-watchlist', userId], queryFn: getMyWatchlist, enabled: Boolean(userId && activeNav === 'My watchlist'), retry: false });
  const todayYear = new Date().getUTCFullYear();
  const releasesToday = useQuery({ queryKey: ['movies', 'released-today', todayYear], queryFn: ({ signal }) => getMovieSchedule('today', todayYear, signal), enabled: Boolean(userId && activeNav === 'For you' && !search.trim()) });
  const hotstarPicks = useQuery({ queryKey: ['movies', 'hotstar-IN'], queryFn: ({ signal }) => getHotstarMovies(signal), enabled: Boolean(userId && activeNav === 'For you' && !search.trim()) });

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setUserId(user?.id ?? null);
      setUserName(user?.user_metadata?.display_name ?? user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? null);
    }).finally(() => setAuthReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserId(user?.id ?? null);
      setUserName(user?.user_metadata?.display_name ?? user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const movies = (search.trim() ? results.data?.results : trending.data?.results) ?? [];
  const navItems = [
    { label: 'For you', icon: Home }, { label: 'Discover', icon: Compass }, { label: 'Community', icon: Users }, { label: 'Schedule', icon: CalendarDays },
  ];
  const libraryItems = [
    { label: 'My watchlist', icon: Bookmark }, { label: 'Movie diary', icon: Layers3 }, { label: 'Movie DNA', icon: Dna }, { label: 'Your people', icon: Heart },
  ];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  if (!authReady) return <div className="auth-loading" aria-label="Loading your session"><span className="brand-mark"><Clapperboard size={19}/></span></div>;
  if (!userId) return <AuthDialog mode={authMode ?? 'signin'} required onClose={() => undefined} onModeChange={setAuthMode} onSuccess={(name) => { setUserName(name); setAuthMode(null); }} />;

  const accountAction = async () => {
    if (!userName) return setAuthMode('signin');
    if (!supabase) { setUserName(null); setUserId(null); return; }
    const { error } = await supabase.auth.signOut();
    if (error) return showToast('We couldn’t sign you out. Please try again.');
    setUserName(null);
    showToast('You’ve been signed out.');
  };

  async function addToWatchlist(movie: Movie) {
    if (!userId) return setAuthMode('signin');
    try {
      await saveWatchlist(movie.id);
      void queryClient.invalidateQueries({ queryKey: ['my-watchlist', userId] });
      showToast(`${movie.title} added to your watchlist.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this movie. Please try again.');
    }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Clapperboard size={19} strokeWidth={2.4} /></span><span>afterscene<span className="brand-dot">.</span></span><button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="nav-drawer-heading"><b>All pages</b><span>Choose a section to open</span></div>
      <div className="profile-switch"><div className="avatar avatar-lime">{userName?.slice(0, 1).toUpperCase() ?? 'R'}</div><div className="profile-switch-copy"><b>{userName ?? 'Your movie self'}</b><span>{userName ? 'Your space' : 'Make it yours'}</span></div><ChevronDown size={16} /></div>
      <div className="nav-caption">YOUR SPACE</div>
      <nav className="nav-list">{navItems.map(({ label, icon: Icon }) => <button key={label} title={label} aria-label={label} className={`nav-item ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="nav-caption library-caption">YOUR COLLECTION</div>
      <nav className="nav-list">{libraryItems.map(({ label, icon: Icon }) => <button key={label} title={label} aria-label={label} className={`nav-item ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false); if (!userName) setAuthMode('signin'); }}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="dna-card"><div className="dna-orbit orbit-one"/><div className="dna-orbit orbit-two"/><Sparkles size={17} className="dna-spark"/><span className="dna-kicker">YOUR TASTE, IN A NUTSHELL</span><strong>Movie DNA</strong><p>Every film you love says something about you.</p><button title="Open Movie DNA" aria-label="Open Movie DNA" onClick={() => setActiveNav('Movie DNA')}><ArrowRight size={14} /></button></div><button className="nav-item help-item" onClick={() => showToast('Afterscene is an early preview. We’re building this together.')}><CircleHelp size={17}/><span>Help & feedback</span></button><div className="sidebar-footer"><span>Made for the love of film</span><span>v0.1 · Preview</span></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <main className="main-column">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><div className="mobile-brand"><span className="brand-mark"><Clapperboard size={16}/></span>afterscene<span className="brand-dot">.</span></div><div className="breadcrumbs"><span>Home</span><span className="crumb-divider">/</span><b>{activeNav}</b></div><div className="topbar-actions"><button className="icon-button theme-toggle" onClick={() => setLightMode((mode) => !mode)} aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'} title={lightMode ? 'Dark mode' : 'Light mode'}>{lightMode ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="icon-button search-shortcut" onClick={() => document.getElementById('movie-search')?.focus()} aria-label="Search movies"><Search size={18}/></button><button className="icon-button notification-button" onClick={() => showToast('You’re all caught up.')} aria-label="Notifications"><Bell size={18}/><i/></button><button className="top-avatar" onClick={() => void accountAction()} aria-label={userName ? 'Sign out' : 'Sign in'}>{userName?.slice(0, 1).toUpperCase() ?? <Users size={16}/>}</button></div></header>

      <div className={`content-wrap ${activeNav === 'Community' ? 'page-community' : activeNav === 'My watchlist' ? 'page-watchlist' : activeNav === 'Schedule' ? 'page-schedule' : activeNav === 'Movie DNA' ? 'page-dna' : activeNav === 'Movie diary' || activeNav === 'Your people' ? 'page-library' : ''}`}>
        {activeNav === 'Community' && <CommunityFeed userId={userId} onSignIn={() => setAuthMode('signin')} onOpenMovie={(movie) => setSelectedMovie(movie)}/>}
        {activeNav === 'Schedule' && <SchedulePage onOpen={setSelectedMovie}/>}
        {activeNav === 'Movie DNA' && <MovieDnaPage userId={userId}/>}
        {(activeNav === 'Movie diary' || activeNav === 'Your people') && <LibraryPage page={activeNav} userId={userId} onSignIn={() => setAuthMode('signin')}/>}
        {activeNav === 'My watchlist' && <section className="watchlist-page"><div className="community-page-heading"><span><Bookmark size={14}/> YOUR COLLECTION</span><h1>Your next great<br/><i>watch is in here.</i></h1><p>Movies you saved for later, all in one place.</p></div>{!userId ? <div className="community-empty"><Bookmark size={25}/><b>Sign in to see your watchlist.</b><button className="page-primary" onClick={() => setAuthMode('signin')}>Sign in</button></div> : watchlist.isPending ? <p className="community-state">Loading your watchlist…</p> : watchlist.isError ? <div className="community-state community-error">{watchlist.error.message}</div> : watchlist.data?.results.length ? <div className="movie-grid">{watchlist.data.results.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div> : <div className="community-empty"><Bookmark size={25}/><b>Your watchlist is ready for its first movie.</b><span>Open a film and tap “Add to watchlist” to save it here.</span><button className="page-primary" onClick={() => setActiveNav('Discover')}>Discover movies</button></div>}</section>}
        {activeNav !== 'Community' && activeNav !== 'Schedule' && activeNav !== 'Movie DNA' && activeNav !== 'My watchlist' && <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR FILM SPACE</div><h1 className="compact-welcome">Welcome back<span>.</span></h1></div></section>}

        {activeNav !== 'Community' && activeNav !== 'Schedule' && activeNav !== 'Movie DNA' && activeNav !== 'My watchlist' && <section className="mood-strip"><div className="mood-copy"><span className="mood-icon"><Sparkles size={17}/></span><div><b>Find a film for your mood</b><span>Coming soon</span></div></div><button className="mood-arrow" onClick={() => showToast("Mood picks are coming soon.")} aria-label="Mood picks coming soon"><ArrowRight size={17}/></button></section>}

        {activeNav !== 'Community' && activeNav !== 'Schedule' && activeNav !== 'Movie DNA' && activeNav !== 'My watchlist' && <section className="film-section"><div className="section-heading"><div><div className="section-eyebrow"><Flame size={13}/> DISCOVER</div><h2>{search.trim() ? 'Search results' : 'Popular films'}<span className="heading-dot">.</span></h2></div><div className="section-tools"><label className="search-box"><Search size={17}/><input id="movie-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a film…"/><kbd>/</kbd></label><button className="filter-button" onClick={() => showToast('Genre filters are coming soon.')}><Settings2 size={16}/><span>Filters</span></button></div></div>
          {((search.trim() && results.isFetching) || (!search.trim() && trending.isFetching)) && <div className="movie-grid">{Array.from({ length: 5 }, (_, i) => <div className="movie-skeleton" key={i}><div className="skeleton-poster"/><div className="skeleton-line"/><div className="skeleton-short"/></div>)}</div>}
          {(search.trim() ? results.isError : trending.isError) && <div className="error-note"><Film size={18}/><div><b>Movie data couldn’t load.</b><span>{(search.trim() ? results.error : trending.error)?.message}</span></div><button onClick={() => search.trim() ? void results.refetch() : void trending.refetch()}>Try again</button></div>}
          {!search.trim() && !trending.isFetching && !trending.isError && movies.length === 0 && <div className="setup-note"><div className="setup-poster"><Film size={23}/></div><div><span className="setup-label">FIRST, A LITTLE SETUP</span><h3>Your movie shelf is almost ready.</h3><p>Add your TMDB API key and Supabase project credentials to start discovering and saving real films.</p><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Get a TMDB key <ArrowUpRightIcon/></a></div></div>}
          {search.trim() && !results.isFetching && !results.isError && movies.length === 0 && results.data && <div className="empty-results"><Search size={21}/><b>No films found for “{search}”</b><span>Try a different title or spelling.</span></div>}
          {movies.length > 0 && <div className="movie-grid">{movies.slice(0, 10).map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div>}
          {!search.trim() && <div className="section-more"><span><i/> Updated as film people find their next favorite</span><button onClick={() => showToast('More discovery lanes are on the way.')}>See all films <ArrowRight size={14}/></button></div>}
        </section>}



        {!search.trim() && activeNav === 'For you' && <section className="home-recommendation-lanes" aria-label="What's new to watch"><article><div className="home-lane-heading"><div><span>RELEASE CALENDAR</span><h2>Arriving today</h2></div><button onClick={() => setActiveNav('Schedule')}>Full schedule <ArrowRight size={14}/></button></div>{releasesToday.isPending ? <p>Checking today's releases…</p> : releasesToday.isError ? <div className="home-lane-error">Today's releases couldn't load. <button onClick={() => void releasesToday.refetch()}>Retry</button></div> : releasesToday.data?.results.length ? <div className="home-lane-movies">{releasesToday.data.results.slice(0, 4).map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div> : <p>No releases are listed for today. Browse upcoming titles in Schedule.</p>}</article><article><div className="home-lane-heading"><div><span>INDIA · TMDB AVAILABILITY</span><h2>{hotstarPicks.data?.providerName ? `On ${hotstarPicks.data.providerName}` : 'Streaming picks'}</h2></div><Star size={18}/></div>{hotstarPicks.isPending ? <p>Checking current streaming availability…</p> : hotstarPicks.isError ? <div className="home-lane-error">Streaming picks couldn't load. <button onClick={() => void hotstarPicks.refetch()}>Retry</button></div> : hotstarPicks.data?.results.length ? <div className="home-lane-movies">{hotstarPicks.data.results.slice(0, 4).map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div> : <p>TMDB has no current Hotstar subscription listings for India.</p>}</article></section>}

        {activeNav !== 'Community' && activeNav !== 'Schedule' && activeNav !== 'Movie DNA' && activeNav !== 'My watchlist' && <footer className="page-footer"><span>AFTERSCENE <span className="brand-dot">®</span> — MADE FOR THE LOVE OF FILM</span><span>Films powered by TMDB <span className="footer-heart">♥</span></span></footer>}
      </div>
    </main>

 {toast && <motion.div className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Sparkles size={16}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss message"><X size={15}/></button></motion.div>}
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(({ label, icon: Icon }) => <button key={label} title={label} aria-label={label} className={activeNav === label ? 'bottom-active' : ''} onClick={() => setActiveNav(label)}><Icon size={19}/></button>)}<button onClick={() => { setActiveNav('My watchlist'); if (!userId) setAuthMode('signin'); }}><Bookmark size={19}/><span>Watchlist</span></button></nav>
    {selectedMovie && <MovieDetailDialog movie={selectedMovie} userName={userName} userId={userId} onClose={() => setSelectedMovie(null)} onSignIn={() => setAuthMode('signin')} onToast={showToast}/>}
    {authMode && <AuthDialog mode={authMode} onClose={() => setAuthMode(null)} onModeChange={setAuthMode} onSuccess={(name) => { setUserName(name); setAuthMode(null); showToast('Welcome to Afterscene.'); }} />}
  </div>;
}

function ArrowUpRightIcon() { return <ArrowRight size={14} className="arrow-up-right"/>; }

function MovieCard({ movie, index, onOpen, onSave }: { movie: Movie; index: number; onOpen: (movie: Movie) => void; onSave: (movie: Movie) => void }) {
  const year = movie.release_date?.slice(0, 4) || '—';
  const poster = movie.poster_path ? `${imageBase}${movie.poster_path}` : undefined;
  return <motion.article className="movie-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.055, 0.35) }}>
    <button className="poster-wrap" onClick={() => onOpen(movie)} aria-label={`Open ${movie.title}${year !== '—' ? `, ${year}` : ''}`}>
      {poster ? <img className="poster-image" src={poster} alt={`${movie.title} poster`} loading="lazy"/> : <div className="poster-placeholder"><Film size={27}/><span>NO POSTER</span></div>}
      <span className="poster-rating"><Star size={12} fill="currentColor"/>{movie.vote_average ? movie.vote_average.toFixed(1) : '—'}</span><span className="poster-overlay"><span>Explore film <ArrowRight size={14}/></span></span>
    </button>
    <div className="movie-info"><div><h3 title={movie.title}>{movie.title}</h3><span>{year}</span></div><button className="save-button" onClick={() => onSave(movie)} aria-label={`Add ${movie.title} to watchlist`}><Plus size={16}/></button></div>
  </motion.article>;
}

export default App;
