import { useCallback, useEffect, useState } from 'react';
import InventoryPage from '../features/inventory/InventoryPage';
import CustomerApp from '../features/storefront/CustomerApp';

/** Keeps the app's lightweight URL routing in one place. */
export default function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const onNavigate = useCallback((path: string) => {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(path);
  }, []);

  if (route === '/admin' || route.startsWith('/admin/')) {
    return <InventoryPage onNavigate={onNavigate} />;
  }

  return <CustomerApp path={route} onNavigate={onNavigate} />;
}
