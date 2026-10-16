import { useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, LoaderCircle, Shell } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function AuthPage({ onNavigate, returnTo }: {
  onNavigate: (path: string) => void;
  returnTo: string;
}) {
  const { signIn, signOut, user, role, configurationError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setPending(true);
    try {
      await signIn(email.trim(), password);
      onNavigate(returnTo);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally { setPending(false); }
  };

  if (user) return <div className="auth-page"><div className="auth-card auth-state-card"><a className="auth-brand" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><span><Shell size={20} /></span> shellhouse</a>
    {role === 'user' ? <><h1>This account has no staff access.</h1><p>The shell collection is public. Ask a superadmin to assign this account an admin role if you need to manage inventory.</p><button className="auth-submit" onClick={() => onNavigate('/customers')}>Browse the collection <ArrowRight size={16} /></button></> : <><h1>You’re signed in.</h1><p>{user.email} · {role ?? 'Role unavailable'}</p><div className="auth-state-actions"><button className="auth-submit" onClick={() => onNavigate(returnTo)}>Open admin <ArrowRight size={16} /></button><button className="auth-link-button" onClick={() => void signOut().catch(signOutError => setError((signOutError as Error).message))}>Sign out</button></div></>}
    {error && <div className="auth-message auth-error"><CircleAlert size={16} /><span>{error}</span></div>}
  </div></div>;

  return <main className="auth-page"><section className="auth-card">
    <a className="auth-brand" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><span><Shell size={20} /></span> shellhouse</a>
    <div className="auth-eyebrow">STAFF ACCESS</div>
    <h1>Welcome back.</h1>
    <p className="auth-intro">Sign in to manage the shell collection. Browsing is open to everyone.</p>
    {configurationError && <div className="auth-message auth-error"><CircleAlert size={16} /><span>{configurationError}</span></div>}
    {error && <div className="auth-message auth-error"><CircleAlert size={16} /><span>{error}</span></div>}
    <form className="auth-form" onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" /></label>
      <button className="auth-submit" type="submit" disabled={pending || Boolean(configurationError)}>{pending ? <><LoaderCircle size={16} className="spin" /> Please wait…</> : <>Sign in <ArrowRight size={16} /></>}</button>
    </form>
    <button className="auth-link-button auth-back-link" onClick={() => onNavigate('/customers')}>Return to the public collection</button>
    <div className="auth-security-note">Staff accounts are provisioned by a project administrator.</div>
  </section></main>;
}
