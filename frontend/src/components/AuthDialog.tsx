import { useState, type FormEvent } from 'react';
import { Clapperboard, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthDialogProps = { mode: 'signin' | 'signup'; onClose: () => void; onSuccess: (name: string) => void; onModeChange: (mode: 'signin' | 'signup') => void; required?: boolean };

export default function AuthDialog({ mode, onClose, onSuccess, onModeChange, required = false }: AuthDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!supabase) return setError('Add your Supabase URL and public anon key to the frontend environment first.');
    if (mode === 'signup' && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) return setError('Username must be 3–24 letters, numbers, or underscores.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onSuccess(data.user.user_metadata?.username ?? data.user.email?.split('@')[0] ?? 'Film lover');
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name: displayName.trim() || username } } });
        if (authError) throw authError;
        if (!data.session) {
          setNotice('Check your inbox for a verification link. Your account will be ready as soon as you confirm your email.');
        } else {
          onSuccess(data.user?.user_metadata?.username ?? username);
        }
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'We couldn’t complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    setError('');
    setNotice('');
    if (!supabase) return setError('Add your Supabase configuration before using account recovery.');
    if (!email) return setError('Enter your account email first.');
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setNotice('If an account exists for that email, a password reset link is on its way.');
  }

  return <div className={`auth-backdrop ${required ? 'auth-gate' : ''}`} role={required ? undefined : 'presentation'} onMouseDown={(event) => { if (!required && event.target === event.currentTarget) onClose(); }}>
    {required && <aside className="auth-gate-visual" aria-label="Afterscene"><div className="auth-gate-wordmark"><span className="brand-mark"><Clapperboard size={18}/></span>afterscene<span className="brand-dot">.</span></div><div className="auth-film-art" aria-hidden="true"><span className="film-orbit film-orbit-one"/><span className="film-orbit film-orbit-two"/><span className="film-glow"/><span className="film-caption">AFTER THE CREDITS</span><span className="film-title">Your films.<br/>Your people.</span></div><span className="auth-gate-footer">A quieter corner for people who love movies.</span></aside>}
    <section className={`auth-dialog ${required ? 'auth-dialog-gate' : ''}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      {!required && <button className="auth-close" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>}
      <div className="auth-brand"><span className="brand-mark"><Clapperboard size={18}/></span><span>afterscene<span className="brand-dot">.</span></span></div>
      <span className="auth-eyebrow">{mode === 'signup' ? 'JOIN AFTERSCENE' : 'YOUR MOVIE SPACE'}</span>
      <h2 id="auth-title">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
      <p className="auth-subtitle">{mode === 'signup' ? 'Save films, share your take, find your people.' : 'Sign in to continue.'}</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} required placeholder="filmlover"/></label>
          <label>Display name <span className="optional-label">OPTIONAL</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={60} placeholder="How people know you"/></label>
        </>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>
        <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required placeholder="At least 8 characters"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
        {mode === 'signin' && <button type="button" className="forgot-link" disabled={busy} onClick={sendPasswordReset}>Forgot password?</button>}
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">{mode === 'signup' ? 'Already part of the story?' : 'New around here?'} <button onClick={() => { setError(''); setNotice(''); onModeChange(mode === 'signup' ? 'signin' : 'signup'); }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
      <span className="auth-privacy">Passwords are managed securely by Supabase Auth.</span>
    </section>
  </div>;
}
