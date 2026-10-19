import { useCallback, useEffect, useState } from 'react';
import InventoryPage from '../features/inventory/InventoryPage';
import CustomerApp from '../features/storefront/CustomerApp';
import { useAuth } from '../features/auth/AuthProvider';
import AuthPage from '../features/auth/AuthPage';
import AdminUsersPage from '../features/auth/AdminUsersPage';
import AdminOrdersPage from '../features/inventory/AdminOrdersPage';
import { CircleAlert, LoaderCircle, Shell } from 'lucide-react';

/** Keeps the app's lightweight URL routing in one place. */
export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const { loading, user, role, roleError, configurationError, signOut } = useAuth();

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const onNavigate = useCallback((path: string) => {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(path);
  }, []);

  const isAdminRoute = route === '/admin' || route.startsWith('/admin/');
  const requiresStaffAuth = isAdminRoute || route === '/sign-in';
  if (!requiresStaffAuth) return <CustomerApp path={route} onNavigate={onNavigate} />;

  const returnTo = isAdminRoute ? route : '/admin';
  if (configurationError && !user) return <AuthPage returnTo={returnTo} onNavigate={onNavigate} />;
  if (loading) return <main className="auth-page"><div className="auth-loading"><LoaderCircle size={22} className="spin" /> Checking your session and account role…</div></main>;
  if (!user) return <AuthPage returnTo={returnTo} onNavigate={onNavigate} />;
  if (roleError || !role) return <main className="auth-page"><section className="auth-card auth-state-card"><a className="auth-brand"><span><Shell size={20} /></span> shellhouse</a><div className="auth-message auth-error"><CircleAlert size={17} /><span>{roleError || 'Your account role is unavailable.'}</span></div><button className="auth-submit" onClick={() => void signOut().catch(signOutError => window.alert((signOutError as Error).message))}>Sign out</button></section></main>;

  if (route === '/admin/users') return role === 'superadmin'
    ? <AdminUsersPage onNavigate={onNavigate} />
    : <Unauthorized role={role} onNavigate={onNavigate} />;
  if (route === '/admin/orders') return role === 'admin' || role === 'superadmin'
    ? <AdminOrdersPage onNavigate={onNavigate} />
    : <Unauthorized role={role} onNavigate={onNavigate} />;
  if (route === '/admin' || route.startsWith('/admin/')) {
    return role === 'admin' || role === 'superadmin'
      ? <InventoryPage onNavigate={onNavigate} />
      : <Unauthorized role={role} onNavigate={onNavigate} />;
  }

  return <CustomerApp path={route} onNavigate={onNavigate} />;
}

function Unauthorized({ role, onNavigate }: { role: string; onNavigate: (path: string) => void }) {
  return <main className="auth-page"><section className="auth-card auth-state-card"><a className="auth-brand"><span><Shell size={20} /></span> shellhouse</a><div className="auth-message auth-error"><CircleAlert size={17} /><span>Your role ({role}) does not have permission to open this page.</span></div><button className="auth-submit" onClick={() => onNavigate('/customers')}>Return to collection</button></section></main>;
}
