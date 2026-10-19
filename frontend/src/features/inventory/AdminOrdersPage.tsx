import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, LogOut, PackageCheck, RotateCw, Shell } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { getAdminOrder, listAdminOrders, type AdminOrderSummary } from '../../shared/api/admin-orders';
import type { ShopOrder } from '../../shared/api/types';
import OrderExpiryCountdown from '../storefront/OrderExpiryCountdown';

const PAGE_SIZE = 20;
const formatMoney = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
  catch { return `${amount} ${currency}`; }
};

export default function AdminOrdersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await listAdminOrders(PAGE_SIZE, offset);
      setOrders(result.data); setTotal(result.pagination.total);
    } catch (loadError) { setError((loadError as Error).message); }
    finally { setLoading(false); }
  }, [offset]);
  useEffect(() => { void refresh(); }, [refresh]);

  const openOrder = async (id: string) => {
    setDetailLoading(true); setError('');
    try { setSelected((await getAdminOrder(id)).data); }
    catch (detailError) { setError((detailError as Error).message); }
    finally { setDetailLoading(false); }
  };

  return <div className="admin-orders-shell">
    <header className="admin-orders-topbar"><a className="admin-orders-brand" href="/admin" onClick={event => { event.preventDefault(); onNavigate('/admin'); }}><Shell size={19} /> shellhouse</a><span>{user?.email} · {role}</span><button className="auth-signout" onClick={() => void signOut().catch(signOutError => setError((signOutError as Error).message))}><LogOut size={15} /> Sign out</button></header>
    <main className="admin-orders-main">
      <button className="admin-orders-back" onClick={() => onNavigate('/admin')}><ArrowLeft size={14} /> Inventory</button>
      <div className="admin-orders-heading"><div><span className="eyebrow">STORE / ORDERS</span><h1>Customer orders</h1><p>Review customer details, payment status, and pending reservations.</p></div><button className="admin-orders-refresh" onClick={() => void refresh()} disabled={loading}><RotateCw size={14} /> Refresh</button></div>
      {error && <div className="error-banner"><CircleAlert size={17} /><span>{error}</span></div>}
      {detailLoading && <div className="loading"><LoaderCircle className="spin" size={21} /> Loading order details…</div>}
      {selected && <section className="admin-order-detail">
        <div className="admin-order-detail-heading"><div><small>ORDER DETAILS</small><h2>{selected.order_number}</h2></div><button onClick={() => setSelected(null)} aria-label="Close order details">×</button></div>
        <div className="admin-order-detail-grid"><div><span>Customer</span><strong>{selected.customer_name}</strong><small>{selected.customer_email}</small><small>{selected.customer_phone}</small></div><div><span>Payment</span><strong className={`shop-status ${selected.payment_status}`}>{selected.payment_status}</strong><small>Order status: {selected.order_status}</small>{selected.payment_status === 'pending' && <OrderExpiryCountdown expiresAt={selected.expires_at} />}</div><div><span>Delivery address</span><strong>{selected.delivery_address.street_address}</strong><small>{selected.delivery_address.city}, {selected.delivery_address.province} {selected.delivery_address.postal_code}</small><small>{selected.delivery_address.country}</small>{selected.delivery_address.address_details && <small>{selected.delivery_address.address_details}</small>}</div></div>
        <div className="admin-order-items">{selected.items.map(item => <div key={item.order_item_id}><span>{item.shell_name} × {item.quantity}</span><strong>{formatMoney(item.line_total, selected.currency)}</strong></div>)}<div><span>Total</span><strong>{formatMoney(selected.total, selected.currency)}</strong></div></div>
      </section>}
      <section className="admin-orders-table-panel">
        {loading ? <div className="loading"><LoaderCircle className="spin" size={21} /> Loading orders…</div> : orders.length === 0 ? <div className="admin-orders-empty"><PackageCheck size={24} /><strong>No orders yet</strong><span>Customer checkouts will appear here.</span></div> : <div className="admin-orders-table-wrap"><table className="admin-orders-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PLACED</th><th>PAYMENT</th><th>TOTAL</th><th>EXPIRY</th><th></th></tr></thead><tbody>{orders.map(order => <tr key={order.order_id} onClick={() => void openOrder(order.order_id)}><td><strong>{order.order_number}</strong><small>{order.order_status}</small></td><td><strong>{order.customer_name}</strong><small>{order.customer_email}</small></td><td>{new Date(order.created_at).toLocaleString()}</td><td><span className={`shop-status ${order.payment_status}`}>{order.payment_status}</span></td><td><strong>{formatMoney(order.total, order.currency)}</strong></td><td>{order.payment_status === 'pending' ? <OrderExpiryCountdown expiresAt={order.expires_at} /> : '—'}</td><td><ChevronRight size={16} /></td></tr>)}</tbody></table></div>}
        <div className="admin-orders-pagination"><span>{total ? `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : '0 orders'}</span><div><button aria-label="Previous page" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}><ChevronLeft size={17} /></button><button aria-label="Next page" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(value => value + PAGE_SIZE)}><ChevronRight size={17} /></button></div></div>
      </section>
    </main>
  </div>;
}
