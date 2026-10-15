import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clapperboard, Heart, Play, Sparkles, Users } from 'lucide-react';
import { discoverMovies } from '../services/movies';
import BrandMark from './BrandMark';

export default function LandingPage({ onSignIn, onCreateAccount }: { onSignIn: () => void; onCreateAccount: () => void }) {
  const featured = useQuery({ queryKey: ['public-featured-film'], queryFn: ({ signal }) => discoverMovies(signal), staleTime: 5 * 60_000 });
  const movie = featured.data?.results.find((item) => item.backdrop_path) ?? featured.data?.results[0];
  const backdrop = movie?.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null;
  return <main className="landing-page">
    <header className="landing-header"><a href="/" className="landing-brand"><BrandMark/> <span>afterscene<span>.</span></span></a><div><button className="landing-signin" onClick={onSignIn}>Sign in</button><button className="landing-join" onClick={onCreateAccount}>Join AfterScene <ArrowRight size={16}/></button></div></header>
    <section className="landing-hero" style={backdrop ? { backgroundImage: `linear-gradient(90deg,#0d0e0b 3%,rgba(13,14,11,.88) 40%,rgba(13,14,11,.24) 100%),linear-gradient(0deg,#0d0e0b 0%,transparent 55%),url(${backdrop})` } : undefined}>
      <div className="landing-copy"><span className="landing-eyebrow"><span/> THE STORY DOESN’T END AT THE CREDITS</span><h1>Find your people.<br/><i>Find your next film.</i></h1><p>Discover movies through the people who love them. Keep your watchlist, share your takes, and build a film identity that’s unmistakably yours.</p><div className="landing-actions"><button onClick={onCreateAccount}>Create your account <ArrowRight size={17}/></button><button className="landing-secondary" onClick={onSignIn}><Play size={15}/> I already have an account</button></div><div className="landing-proof"><span><Users size={15}/> Real film people</span><span><Heart size={15}/> Honest reactions</span><span><Sparkles size={15}/> Taste that’s yours</span></div></div>
      {movie && <aside className="landing-feature"><span>IN THE SPOTLIGHT</span><b>{movie.title}</b><small>{movie.release_date?.slice(0, 4) || 'Now showing in discovery'}</small></aside>}
      <div className="landing-frame" aria-hidden="true"><span/><span/><span/></div>
    </section>
    <footer className="landing-footer"><span>AFTERSCENE</span><span>Movies are better when the conversation continues.</span><Clapperboard size={17}/></footer>
  </main>;
}

