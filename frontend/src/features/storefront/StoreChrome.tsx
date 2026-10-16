import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { ArrowRight, Shell, ShoppingBag } from 'lucide-react';
import { getShopCart } from '../../shared/api';
import { useAuth } from '../auth/AuthProvider';

export function StoreHeader({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const isStaff = role === 'admin' || role === 'superadmin';
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadCount = () => {
      void getShopCart().then(cart => {
        if (active) setCartCount(cart.items.reduce((count, item) => count + item.quantity, 0));
      }).catch(() => { if (active) setCartCount(0); });
    };
    loadCount();
    window.addEventListener('shop-cart-updated', loadCount);
    return () => {
      active = false;
      window.removeEventListener('shop-cart-updated', loadCount);
    };
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault();
    onNavigate(path);
  };

  return <header className="store-header">
    <a href="/customers" className="store-brand" onClick={event => navigate(event, '/customers')}>
      <span className="store-brand-mark"><Shell size={21} /></span>
      <span>shellhouse<small>THE SHELL COLLECTION</small></span>
    </a>
    <nav className="store-header-nav">
      <a href="/customers#collection" onClick={event => { if (window.location.pathname !== '/customers') navigate(event, '/customers'); }}>The collection</a>
      <a href="/customers#about">Our approach</a>
      <a href="/orders" onClick={event => navigate(event, '/orders')}>Orders</a>
    </nav>
    <div className="store-header-actions">
      <a className="header-collection-link" href="/customers#collection" onClick={event => { if (window.location.pathname !== '/customers') navigate(event, '/customers'); }}>Explore <ArrowRight size={14} /></a>
      <a className="store-cart-link" href="/cart" onClick={event => navigate(event, '/cart')} aria-label={`Shopping bag, ${cartCount} items`}>
        <ShoppingBag size={14} /><span>Bag</span><b>{cartCount}</b>
      </a>
      {isStaff ? <>
        <a className="store-signout" href="/admin" onClick={event => navigate(event, '/admin')}>Admin</a>
        <button className="store-signout" title={user?.email || 'Sign out'} onClick={() => void signOut().catch(error => window.alert((error as Error).message))}>Sign out</button>
      </> : null}
    </div>
  </header>;
}

export function StoreFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <footer id="about" className="store-footer">
    <a href="/customers" className="footer-brand" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><Shell size={17} /> shellhouse</a>
    <span>Natural forms, thoughtfully collected.</span>
    <span>© Shellhouse Collection</span>
  </footer>;
}
