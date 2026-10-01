import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, Bell, Bookmark, ChevronDown, CircleHelp, Clapperboard, Compass, Film, Flame, Heart, Home, Layers3, Menu, MoreHorizontal, Plus, Search, Settings2, Sparkles, Star, Users, X } from 'lucide-react';
import AuthDialog from './components/AuthDialog';
import CommunityFeed from './components/CommunityFeed';
import MovieDetailDialog from './components/MovieDetailDialog';
import { discoverMovies, searchMovies } from './services/movies';
import { getMyWatchlist, saveWatchlist } from './services/movieActions';
import { supabase } from './lib/supabase';
import type { Movie } from './types/movie';

const imageBase = 'https://image.tmdb.org/t/p/w500';

function App() {
  const [search, setSearch] = useState('');
  const [activeNav, setActiveNav] = useState('For you');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const queryClient = useQueryClient();
  const trending = useQuery({ queryKey: ['movies', 'trending'], queryFn: ({ signal }) => discoverMovies(signal), enabled: !search.trim() });
  const results = useQuery({ queryKey: ['movies', 'search', search], queryFn: ({ signal }) => searchMovies(search.trim(), signal), enabled: search.trim().length >= 2 });
  const watchlist = useQuery({ queryKey: ['my-watchlist', userId], queryFn: getMyWatchlist, enabled: Boolean(userId && activeNav === 'My watchlist'), retry: false });

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setUserId(user?.id ?? null);
      setUserName(user?.user_metadata?.display_name ?? user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserId(user?.id ?? null);
      setUserName(user?.user_metadata?.display_name ?? user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const movies = (search.trim() ? results.data?.results : trending.data?.results) ?? [];
  const navItems = [
    { label: 'For you', icon: Home }, { label: 'Discover', icon: Compass }, { label: 'Community', icon: Users },
  ];
  const libraryItems = [
    { label: 'My watchlist', icon: Bookmark }, { label: 'Movie diary', icon: Layers3 }, { label: 'Your people', icon: Heart },
  ];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

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
      <div className="profile-switch"><div className="avatar avatar-lime">{userName?.slice(0, 1).toUpperCase() ?? 'R'}</div><div className="profile-switch-copy"><b>{userName ?? 'Your movie self'}</b><span>{userName ? 'Your space' : 'Make it yours'}</span></div><ChevronDown size={16} /></div>
      <div className="nav-caption">YOUR SPACE</div>
      <nav className="nav-list">{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{label === 'Discover' && <span className="nav-new">NEW</span>}</button>)}</nav>
      <div className="nav-caption library-caption">YOUR COLLECTION</div>
      <nav className="nav-list">{libraryItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false); if (!userName) setAuthMode('signin'); }}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="dna-card"><div className="dna-orbit orbit-one"/><div className="dna-orbit orbit-two"/><Sparkles size={17} className="dna-spark"/><span className="dna-kicker">YOUR TASTE, IN A NUTSHELL</span><strong>Movie DNA</strong><p>Every film you love says something about you.</p><button onClick={() => showToast(userName ? 'Rate a few films to start building your Movie DNA.' : 'Join Afterscene to build your Movie DNA.')}>Explore your taste <ArrowRight size={14} /></button></div><button className="nav-item help-item" onClick={() => showToast('Afterscene is an early preview. We’re building this together.')}><CircleHelp size={17}/><span>Help & feedback</span></button><div className="sidebar-footer"><span>Made for the love of film</span><span>v0.1 · Preview</span></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <main className="main-column">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><div className="mobile-brand"><span className="brand-mark"><Clapperboard size={16}/></span>afterscene<span className="brand-dot">.</span></div><div className="breadcrumbs"><span>Home</span><span className="crumb-divider">/</span><b>{activeNav}</b></div><div className="topbar-actions"><button className="icon-button search-shortcut" onClick={() => document.getElementById('movie-search')?.focus()} aria-label="Search movies"><Search size={18}/></button><button className="icon-button notification-button" onClick={() => showToast('You’re all caught up.')} aria-label="Notifications"><Bell size={18}/><i/></button><button className="top-avatar" onClick={() => void accountAction()} aria-label={userName ? 'Sign out' : 'Sign in'}>{userName?.slice(0, 1).toUpperCase() ?? <Users size={16}/>}</button></div></header>

      <div className={`content-wrap ${activeNav === 'Community' ? 'page-community' : activeNav === 'My watchlist' ? 'page-watchlist' : ''}`}>
        {activeNav === 'Community' && <CommunityFeed userId={userId} onSignIn={() => setAuthMode('signin')}/>}
        {activeNav === 'My watchlist' && <section className="watchlist-page"><div className="community-page-heading"><span><Bookmark size={14}/> YOUR COLLECTION</span><h1>Your next great<br/><i>watch is in here.</i></h1><p>Movies you saved for later, all in one place.</p></div>{!userId ? <div className="community-empty"><Bookmark size={25}/><b>Sign in to see your watchlist.</b><button className="page-primary" onClick={() => setAuthMode('signin')}>Sign in</button></div> : watchlist.isPending ? <p className="community-state">Loading your watchlist…</p> : watchlist.isError ? <div className="community-state community-error">{watchlist.error.message}</div> : watchlist.data?.results.length ? <div className="movie-grid">{watchlist.data.results.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div> : <div className="community-empty"><Bookmark size={25}/><b>Your watchlist is ready for its first movie.</b><span>Open a film and tap “Add to watchlist” to save it here.</span><button className="page-primary" onClick={() => setActiveNav('Discover')}>Discover movies</button></div>}</section>}
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> WEDNESDAY, SEPTEMBER 30</div><h1>{userName ? <>Good to see you,<br/><span>{userName}.</span></> : <>Your next favorite<br/><span>starts here.</span></>}</h1><p className="welcome-copy">A little less scrolling. A lot more <em>“you have to watch this.”</em></p></div><div className="welcome-stamp"><div className="stamp-inner"><span>EST.</span><b>2025</b><span>FILM PEOPLE</span></div></div></section>

        <section className="mood-strip"><div className="mood-copy"><span className="mood-icon"><Sparkles size={17}/></span><div><b>What’s the vibe tonight?</b><span>We’ll find a story that fits.</span></div></div><div className="mood-options">{['Need a laugh', 'Feel something', 'Plot twist me'].map((mood, i) => <button key={mood} onClick={() => showToast('Mood picks are coming once your taste profile is connected.')} className="mood-chip"><span>{['☀', '♡', '↗'][i]}</span>{mood}</button>)}</div><button className="mood-arrow" onClick={() => showToast('Tell us your mood to shape your picks.')} aria-label="Choose mood"><ArrowRight size={17}/></button></section>

        <section className="film-section"><div className="section-heading"><div><div className="section-eyebrow"><Flame size={13}/> THE GOOD STUFF</div><h2>{search.trim() ? 'Search results' : 'Find your next watch'}<span className="heading-dot">.</span></h2><p className="section-subtitle">{search.trim() ? `Stories matching “${search}”` : 'Trending right now, waiting for their person.'}</p></div><div className="section-tools"><label className="search-box"><Search size={17}/><input id="movie-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a film…"/><kbd>/</kbd></label><button className="filter-button" onClick={() => showToast('Genre filters are coming soon.')}><Settings2 size={16}/><span>Filters</span></button></div></div>
          {((search.trim() && results.isFetching) || (!search.trim() && trending.isFetching)) && <div className="movie-grid">{Array.from({ length: 5 }, (_, i) => <div className="movie-skeleton" key={i}><div className="skeleton-poster"/><div className="skeleton-line"/><div className="skeleton-short"/></div>)}</div>}
          {(search.trim() ? results.isError : trending.isError) && <div className="error-note"><Film size={18}/><div><b>Movie data couldn’t load.</b><span>{(search.trim() ? results.error : trending.error)?.message}</span></div><button onClick={() => search.trim() ? void results.refetch() : void trending.refetch()}>Try again</button></div>}
          {!search.trim() && !trending.isFetching && !trending.isError && movies.length === 0 && <div className="setup-note"><div className="setup-poster"><Film size={23}/></div><div><span className="setup-label">FIRST, A LITTLE SETUP</span><h3>Your movie shelf is almost ready.</h3><p>Add your TMDB API key and Supabase project credentials to start discovering and saving real films.</p><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Get a TMDB key <ArrowUpRightIcon/></a></div></div>}
          {search.trim() && !results.isFetching && !results.isError && movies.length === 0 && results.data && <div className="empty-results"><Search size={21}/><b>No films found for “{search}”</b><span>Try a different title or spelling.</span></div>}
          {movies.length > 0 && <div className="movie-grid">{movies.slice(0, 10).map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={setSelectedMovie} onSave={addToWatchlist}/>)}</div>}
          {!search.trim() && <div className="section-more"><span><i/> Updated as film people find their next favorite</span><button onClick={() => showToast('More discovery lanes are on the way.')}>See all films <ArrowRight size={14}/></button></div>}
        </section>

        <section className="community-section"><div className="community-cover"><div className="community-grain"/><div className="community-sticker"><Users size={14}/> THE PEOPLE MAKE THE MOVIES</div><div className="community-content"><div><span className="section-eyebrow light-eyebrow">MORE THAN A WATCHLIST</span><h2>Film hits different<br/>when it’s <i>shared.</i></h2><p>Find your corner of the internet that actually gets the ending.</p><button onClick={() => setActiveNav('Community')}>Find your people <ArrowRight size={15}/></button></div><div className="community-art"><div className="art-disc disc-back"/><div className="art-disc disc-front"><span>AS</span></div><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">✳</div></div></div></div></section>

        <footer className="page-footer"><span>AFTERSCENE <span className="brand-dot">®</span> — MADE FOR THE LOVE OF FILM</span><span>Films powered by TMDB <span className="footer-heart">♥</span></span></footer>
      </div>
    </main>

    <aside className="right-column"><div className="right-heading"><span>YOUR CORNER</span><button className="icon-button" aria-label="More options" onClick={() => showToast('More community features are on the way.')}><MoreHorizontal size={19}/></button></div><section className="side-card welcome-card"><div className="side-card-top"><div className="side-icon"><Sparkles size={16}/></div><span className="side-label">A NOTE FROM AFTERSCENE</span></div><h3>There’s more to a movie than the credits.</h3><p>It’s the friend who recommended it. The scene you can’t stop thinking about. The group chat after.</p><button onClick={() => showToast('Your movie community starts with you.')}>This is your space <ArrowRight size={14}/></button><div className="welcome-card-mark">A<span>.</span></div></section>
      <section className="side-card battle-card"><div className="side-card-top"><div className="side-icon battle-icon"><Flame size={16}/></div><span className="side-label">QUICK QUESTION</span><span className="live-label"><i/> OPEN</span></div><p className="battle-question">Which world would you rather get lost in?</p><div className="battle-choices"><button onClick={() => showToast('Sign in to cast a real community vote.')}><span className="choice-icon">◉</span><span>Somewhere out there</span><ArrowDownRight size={15}/></button><button onClick={() => showToast('Sign in to cast a real community vote.')}><span className="choice-icon choice-alt">◈</span><span>Somewhere magical</span><ArrowDownRight size={15}/></button></div><span className="battle-meta">Be the first to weigh in</span></section>
      <section className="side-card taste-card"><div className="taste-pattern"/><div className="side-card-top"><div className="side-icon taste-icon"><Heart size={16}/></div><span className="side-label">TASTE CHECK</span></div><h3>Find someone<br/>who gets <i>your</i> films.</h3><p>Your people are out there. Let’s find them.</p><button onClick={() => showToast(userName ? 'Rate a few movies to get your first taste match.' : 'Join Reelkind to meet your movie people.')}>Explore taste match <ArrowRight size={14}/></button></section>
      <section className="side-card invite-card"><div className="invite-avatars"><span>✳</span><span>R</span><span>✦</span><span><Plus size={14}/></span></div><div><b>Good taste is better shared.</b><span>Bring your movie people along.</span></div><button onClick={() => showToast('Invite links are coming soon.')} aria-label="Invite a friend"><ArrowRight size={16}/></button></section>
      <div className="right-footer"><a href="#about">About</a><a href="#guidelines">Community guidelines</a><a href="#privacy">Privacy</a><span>© 2026 Afterscene</span></div>
    </aside>
    {toast && <motion.div className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Sparkles size={16}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss message"><X size={15}/></button></motion.div>}
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'bottom-active' : ''} onClick={() => setActiveNav(label)}><Icon size={19}/><span>{label === 'For you' ? 'Home' : label}</span></button>)}<button onClick={() => { setActiveNav('My watchlist'); if (!userId) setAuthMode('signin'); }}><Bookmark size={19}/><span>Watchlist</span></button></nav>
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
    <div className="movie-info"><div><h3 title={movie.title}>{movie.title}</h3><span>{year}{movie.overview ? ' · ' + movie.overview.slice(0, 48) + (movie.overview.length > 48 ? '…' : '') : ''}</span></div><button className="save-button" onClick={() => onSave(movie)} aria-label={`Add ${movie.title} to watchlist`}><Plus size={16}/></button></div>
  </motion.article>;
}

export default App;
