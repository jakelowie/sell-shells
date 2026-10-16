import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, Minus, Plus, Printer, Shell, ShoppingBag, Trash2 } from 'lucide-react';
import {
  captureShopOrder, createShopOrder, getShopCart, getShopConfig, getShopOrder, getShopOrders,
  removeShopCartItem, updateShopCartItem,
  type DeliveryAddress, type ShopCart, type ShopConfig, type ShopOrder, type ShopOrderSummary
} from '../../shared/api';
import { StoreFooter, StoreHeader } from './StoreChrome';

type Navigate = (path: string) => void;
type PaypalOrderData = { orderID: string };
type PaypalButtonActions = { order: { capture: () => Promise<unknown> } };
type PaypalButtonsOptions = {
  createOrder: () => Promise<string>;
  onApprove: (data: PaypalOrderData, actions: PaypalButtonActions) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};
type PaypalButtons = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => void;
};
type PaypalNamespace = { Buttons: (options: PaypalButtonsOptions) => PaypalButtons };
declare global { interface Window { paypal?: PaypalNamespace } }

let paypalSdkLoad: Promise<PaypalNamespace> | undefined;

function loadPaypalSdk(clientId: string, currency: string): Promise<PaypalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkLoad) return paypalSdkLoad;
  const loadPromise: Promise<PaypalNamespace> = new Promise<PaypalNamespace>((resolve, reject) => {
    const existing = document.getElementById('sell-shells-paypal-sdk') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const loaded = () => window.paypal ? resolve(window.paypal) : reject(new Error('PayPal checkout did not finish loading.'));
    const failed = () => reject(new Error('PayPal checkout could not be loaded. Check your network and sandbox configuration.'));
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.id = 'sell-shells-paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
      script.async = true;
      document.body.appendChild(script);
    }
  }).catch((error: unknown): never => { paypalSdkLoad = undefined; throw error; });
  paypalSdkLoad = loadPromise;
  return loadPromise;
}

function PayPalButton({ config, createOrder, onPaid, onCancel, onError }: {
  config: ShopConfig;
  createOrder: () => Promise<string>;
  onPaid: (orderId: string) => Promise<void>;
  onCancel?: () => void;
  onError: (error: unknown) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!config.paypal_client_id || !config.currency || !config.checkout_enabled || !container.current) return;
    let active = true;
    let buttons: PaypalButtons | undefined;
    void loadPaypalSdk(config.paypal_client_id, config.currency).then(paypal => {
      if (!active || !container.current) return;
      buttons = paypal.Buttons({
        createOrder,
        onApprove: async data => { await onPaid(data.orderID); },
        onCancel,
        onError
      });
      return buttons.render(container.current);
    }).catch(onError);
    return () => { active = false; buttons?.close?.(); };
  }, [config.checkout_enabled, config.currency, config.paypal_client_id, createOrder, onCancel, onError]);
  return <div ref={container} className="paypal-button-container" aria-label="Pay with PayPal" />;
}

function money(value: number, currency: string | null | undefined): string {
  if (!currency) return `${new Intl.NumberFormat().format(value)} (currency not configured)`;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); }
  catch { return `${value} ${currency}`; }
}

function PageFrame({ onNavigate, children }: { onNavigate: Navigate; children: ReactNode }) {
  return <div className="storefront shop-storefront"><StoreHeader onNavigate={onNavigate} />{children}<StoreFooter onNavigate={onNavigate} /></div>;
}

function ShopLoading({ label }: { label: string }) {
  return <div className="shop-state"><LoaderCircle className="spin" size={22} />{label}</div>;
}

function ShopError({ message }: { message: string }) {
  return <div className="shop-error-banner" role="alert"><CircleAlert size={17} /><span>{message}</span></div>;
}

function BackLink({ onNavigate }: { onNavigate: Navigate }) {
  return <a className="shop-back-link" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><ArrowLeft size={14} /> Continue browsing</a>;
}

export function ShopCartPage({ onNavigate }: { onNavigate: Navigate }) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const subtotal = useMemo(() => cart?.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0) ?? 0, [cart]);

  const refresh = useCallback(async () => {
    setError('');
    try { setCart(await getShopCart()); }
    catch (loadError) { setError((loadError as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    getShopConfig().then(result => setConfig(result.data)).catch(() => setConfig(null));
  }, [refresh]);

  const changeQuantity = async (shellId: string, quantity: number) => {
    setSaving(shellId); setError('');
    try { setCart(await updateShopCartItem(shellId, quantity)); }
    catch (saveError) { setError((saveError as Error).message); }
    finally { setSaving(''); }
  };
  const removeItem = async (shellId: string) => {
    setSaving(shellId); setError('');
    try { setCart(await removeShopCartItem(shellId)); }
    catch (removeError) { setError((removeError as Error).message); }
    finally { setSaving(''); }
  };

  return <PageFrame onNavigate={onNavigate}>
    <main className="shop-main">
      <BackLink onNavigate={onNavigate} />
      <header className="shop-page-heading"><span className="store-kicker">YOUR SELECTION</span><h1>Shopping bag</h1><p>Review your specimens before continuing to checkout.</p></header>
      {loading ? <ShopLoading label="Loading your bag…" /> : error && !cart ? <ShopError message={error} /> : !cart?.items.length ? (
        <section className="shop-empty"><span><ShoppingBag size={22} /></span><h2>Your bag is waiting</h2><p>Explore the collection and add a shell that catches your eye.</p><button className="shop-primary-button" onClick={() => onNavigate('/customers')}>Explore the collection <ArrowRight size={15} /></button></section>
      ) : <>
        {error && <ShopError message={error} />}
        <div className="shop-cart-layout">
          <section className="shop-cart-items" aria-label="Items in your bag">
            {cart.items.map(item => {
              const unavailable = Boolean(item.is_deleted) || item.price == null || item.available < item.quantity;
              return <article className="shop-cart-item" key={item.shell_id}>
                <div className="shop-item-placeholder"><Shell size={24} strokeWidth={1} /></div>
                <div className="shop-item-description">
                  <h2>{item.shell_name || 'Untitled shell'}</h2>
                  <span>{unavailable ? 'Currently unavailable' : `${item.available} available`}</span>
                  <div className="shop-quantity-control" aria-label={`Quantity for ${item.shell_name}`}>
                    <button aria-label="Decrease quantity" disabled={saving === item.shell_id || item.quantity <= 1} onClick={() => void changeQuantity(item.shell_id, item.quantity - 1)}><Minus size={13} /></button>
                    <span>{item.quantity}</span>
                    <button aria-label="Increase quantity" disabled={saving === item.shell_id || item.quantity >= 100 || item.quantity >= item.available} onClick={() => void changeQuantity(item.shell_id, item.quantity + 1)}><Plus size={13} /></button>
                  </div>
                </div>
                <strong className="shop-line-total">{item.price == null ? 'Price unavailable' : money(item.price * item.quantity, config?.currency)}</strong>
                <button className="shop-remove-item" aria-label={`Remove ${item.shell_name || 'shell'}`} disabled={saving === item.shell_id} onClick={() => void removeItem(item.shell_id)}><Trash2 size={15} /></button>
              </article>;
            })}
          </section>
          <aside className="shop-summary">
            <h2>Order summary</h2>
            <div><span>Subtotal</span><strong>{money(subtotal, config?.currency)}</strong></div>
            <div><span>Delivery</span><strong>{config ? money(config.delivery_fee, config.currency) : 'Calculated at checkout'}</strong></div>
            <p>Taxes, if applicable, are not calculated because no tax rules are configured.</p>
            <button className="shop-primary-button" disabled={cart.items.some(item => item.is_deleted || item.price == null || item.price <= 0 || item.available < item.quantity)} onClick={() => onNavigate('/checkout')}>Continue to checkout <ArrowRight size={15} /></button>
            {!config?.checkout_enabled && <span className="shop-configuration-note">Checkout is not yet configured by the store.</span>}
          </aside>
        </div>
      </>}
    </main>
  </PageFrame>;
}

type CheckoutValues = { name: string; email: string; phone: string; address: DeliveryAddress };
const initialCheckout: CheckoutValues = {
  name: '', email: '', phone: '',
  address: { street_address: '', city: '', province: '', postal_code: '', country: '', address_details: '' }
};

export function ShopCheckoutPage({ onNavigate }: { onNavigate: Navigate }) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [values, setValues] = useState(initialCheckout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [createdOrder, setCreatedOrder] = useState<ShopOrder | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const subtotal = cart?.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0) ?? 0;
  const total = subtotal + (config?.delivery_fee ?? 0);

  useEffect(() => {
    let active = true;
    Promise.all([getShopCart(), getShopConfig()]).then(([nextCart, nextConfig]) => {
      if (!active) return;
      setCart(nextCart); setConfig(nextConfig.data);
    }).catch(loadError => { if (active) setError((loadError as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createPaypalOrder = useCallback(async () => {
    if (!formRef.current?.reportValidity()) throw new Error('Complete the required customer and delivery information.');
    if (createdOrder?.paypal_order_id) return createdOrder.paypal_order_id;
    setBusy(true); setOrderError('');
    try {
      const order = await createShopOrder({
        idempotency_key: idempotencyKey,
        customer: { name: values.name, email: values.email, phone: values.phone },
        delivery_address: values.address
      });
      if (!order.paypal_order_id) throw new Error('PayPal did not return an order reference.');
      setCreatedOrder(order);
      return order.paypal_order_id;
    } catch (createError) {
      setOrderError((createError as Error).message);
      throw createError;
    } finally { setBusy(false); }
  }, [createdOrder, idempotencyKey, values]);

  const completePayment = useCallback(async (paypalOrderId: string) => {
    if (!createdOrder || paypalOrderId !== createdOrder.paypal_order_id) throw new Error('PayPal returned a different order than the one created by this checkout.');
    setBusy(true); setOrderError('');
    try {
      const paid = await captureShopOrder(createdOrder.order_id);
      onNavigate(`/orders/${encodeURIComponent(paid.order_id)}`);
    } catch (captureError) {
      setOrderError((captureError as Error).message);
      throw captureError;
    } finally { setBusy(false); }
  }, [createdOrder, onNavigate]);

  const payPalError = useCallback((paymentError: unknown) => {
    setOrderError((paymentError as Error)?.message || 'PayPal could not complete checkout. You can try again.');
  }, []);

  const setAddress = (field: keyof DeliveryAddress, value: string) => setValues(current => ({ ...current, address: { ...current.address, [field]: value } }));
  const submitNoop = (event: FormEvent) => event.preventDefault();
  const unavailable = !cart?.items.length || cart.items.some(item => item.is_deleted || item.price == null || item.price <= 0 || item.available < item.quantity);

  return <PageFrame onNavigate={onNavigate}>
    <main className="shop-main">
      <BackLink onNavigate={onNavigate} />
      <header className="shop-page-heading"><span className="store-kicker">SECURE CHECKOUT</span><h1>Your delivery details</h1><p>No customer account is needed. Your confirmation is saved to this browser session.</p></header>
      {loading ? <ShopLoading label="Preparing checkout…" /> : error ? <ShopError message={error} /> : !cart?.items.length ? (
        <section className="shop-empty"><h2>Your bag is empty</h2><p>Add a shell before checking out.</p><button className="shop-primary-button" onClick={() => onNavigate('/customers')}>Browse the collection</button></section>
      ) : <div className="shop-checkout-layout">
        <form className="shop-checkout-form" ref={formRef} onSubmit={submitNoop}>
          <section className="shop-form-section">
            <h2>Contact information</h2>
            <label className="shop-field">Recipient full name<input autoComplete="name" required minLength={2} maxLength={120} value={values.name} onChange={event => setValues(current => ({ ...current, name: event.target.value }))} /></label>
            <div className="shop-field-grid">
              <label className="shop-field">Email<input type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={event => setValues(current => ({ ...current, email: event.target.value }))} /></label>
              <label className="shop-field">Contact number<input type="tel" autoComplete="tel" required minLength={7} maxLength={30} pattern="\+?[0-9().\-\s]+" value={values.phone} onChange={event => setValues(current => ({ ...current, phone: event.target.value }))} /></label>
            </div>
          </section>
          <section className="shop-form-section">
            <h2>Delivery address</h2>
            <label className="shop-field">Street address and building number<input autoComplete="street-address" required minLength={3} maxLength={200} value={values.address.street_address} onChange={event => setAddress('street_address', event.target.value)} /></label>
            <div className="shop-field-grid">
              <label className="shop-field">City or municipality<input autoComplete="address-level2" required minLength={2} maxLength={100} value={values.address.city} onChange={event => setAddress('city', event.target.value)} /></label>
              <label className="shop-field">Province or state<input autoComplete="address-level1" required minLength={2} maxLength={100} value={values.address.province} onChange={event => setAddress('province', event.target.value)} /></label>
              <label className="shop-field">Postal code<input autoComplete="postal-code" required minLength={2} maxLength={20} value={values.address.postal_code} onChange={event => setAddress('postal_code', event.target.value)} /></label>
              <label className="shop-field">Country<input autoComplete="country-name" required minLength={2} maxLength={100} value={values.address.country} onChange={event => setAddress('country', event.target.value)} /></label>
            </div>
            <label className="shop-field">Address details or delivery instructions <span>(optional)</span><textarea rows={3} maxLength={500} value={values.address.address_details} onChange={event => setAddress('address_details', event.target.value)} /></label>
          </section>
          {orderError && <ShopError message={orderError} />}
          {!config?.checkout_enabled && <p className="shop-configuration-note">PayPal checkout is unavailable until the store configures its currency and PayPal credentials.</p>}
          {config && !unavailable && <PayPalButton config={config} createOrder={createPaypalOrder} onPaid={completePayment} onError={payPalError} onCancel={() => setOrderError('Payment was cancelled. The pending order remains available in order history until its 30-minute reservation expires.')} />}
          {busy && <p className="shop-payment-progress"><LoaderCircle size={15} className="spin" /> Contacting PayPal securely…</p>}
          {unavailable && <ShopError message="One or more cart items are unavailable or exceed the current stock. Return to your bag to adjust quantities." />}
        </form>
        <aside className="shop-summary shop-checkout-summary">
          <h2>Order summary</h2>
          {cart.items.map(item => <div className="shop-summary-line" key={item.shell_id}><span>{item.shell_name || 'Untitled shell'} <small>× {item.quantity}</small></span><strong>{money((item.price ?? 0) * item.quantity, config?.currency)}</strong></div>)}
          <div><span>Subtotal</span><strong>{money(subtotal, config?.currency)}</strong></div>
          <div><span>Delivery</span><strong>{money(config?.delivery_fee ?? 0, config?.currency)}</strong></div>
          <div className="shop-summary-total"><span>Total</span><strong>{money(total, config?.currency)}</strong></div>
          <p>The server will verify prices and stock again before creating the PayPal order.</p>
        </aside>
      </div>}
    </main>
  </PageFrame>;
}

export function ShopOrdersPage({ onNavigate }: { onNavigate: Navigate }) {
  const [orders, setOrders] = useState<ShopOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { getShopOrders().then(result => setOrders(result.data)).catch(loadError => setError((loadError as Error).message)).finally(() => setLoading(false)); }, []);
  return <PageFrame onNavigate={onNavigate}>
    <main className="shop-main">
      <BackLink onNavigate={onNavigate} />
      <header className="shop-page-heading"><span className="store-kicker">YOUR PURCHASES</span><h1>Order history</h1><p>Orders placed in this browser session.</p></header>
      {loading ? <ShopLoading label="Loading your orders…" /> : error ? <ShopError message={error} /> : !orders.length ? <section className="shop-empty"><span><ShoppingBag size={22} /></span><h2>No orders yet</h2><p>Your completed and pending orders will appear here.</p><button className="shop-primary-button" onClick={() => onNavigate('/customers')}>Browse the collection</button></section> : (
        <section className="shop-orders-list">{orders.map(order => <button className="shop-order-row" key={order.order_id} onClick={() => onNavigate(`/orders/${encodeURIComponent(order.order_id)}`)}>
          <span><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString()}</small></span>
          <span className={`shop-status ${order.payment_status}`}>{order.payment_status}</span>
          <strong>{money(order.total, order.currency)}</strong><ArrowRight size={16} />
        </button>)}</section>
      )}
    </main>
  </PageFrame>;
}

export function ShopOrderPage({ orderId, onNavigate }: { orderId: string; onNavigate: Navigate }) {
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const refresh = useCallback(async () => {
    setError('');
    try { setOrder(await getShopOrder(orderId)); }
    catch (loadError) { setError((loadError as Error).message); }
    finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { void refresh(); getShopConfig().then(result => setConfig(result.data)).catch(() => setConfig(null)); }, [refresh]);

  const retryOrderPayment = useCallback(async () => {
    if (!order?.paypal_order_id) throw new Error('This order does not have an active PayPal order.');
    return order.paypal_order_id;
  }, [order]);
  const completePayment = useCallback(async (paypalOrderId: string) => {
    if (!order || paypalOrderId !== order.paypal_order_id) throw new Error('PayPal returned a different order reference.');
    setPaymentError('');
    try { setOrder(await captureShopOrder(order.order_id)); }
    catch (paymentFailure) { setPaymentError((paymentFailure as Error).message); throw paymentFailure; }
  }, [order]);
  const paypalError = useCallback((paymentFailure: unknown) => setPaymentError((paymentFailure as Error)?.message || 'PayPal payment failed.'), []);

  const address = order?.delivery_address ?? initialCheckout.address;
  return <PageFrame onNavigate={onNavigate}>
    <main className="shop-main shop-invoice-main">
      <BackLink onNavigate={onNavigate} />
      {loading ? <ShopLoading label="Retrieving your order…" /> : error ? <ShopError message={error} /> : order && <>
        <header className="shop-page-heading"><span className="store-kicker">ORDER CONFIRMATION</span><h1>{order.payment_status === 'captured' ? 'Thank you for your order' : 'Order details'}</h1><p>Your order reference is {order.order_number}.</p></header>
        {paymentError && <ShopError message={paymentError} />}
        {order.payment_status === 'pending' && <section className="shop-pending-payment"><strong>Payment pending</strong><span>This order has not been paid. Complete the PayPal payment below or return to the order later.</span>
          {config && <PayPalButton config={config} createOrder={retryOrderPayment} onPaid={completePayment} onError={paypalError} onCancel={() => setPaymentError('Payment was cancelled. This order remains unpaid until completed or its reservation expires.')} />}
        </section>}
        <article className="shop-invoice" id="shop-invoice">
          <div className="shop-invoice-top"><div className="shop-invoice-brand"><Shell size={19} /> shellhouse<small>THE SHELL COLLECTION</small></div><div><span className={`shop-status ${order.payment_status}`}>{order.payment_status}</span><h2>Invoice</h2></div></div>
          <div className="shop-invoice-meta"><div><span>Order number</span><strong>{order.order_number}</strong></div><div><span>Order date</span><strong>{new Date(order.created_at).toLocaleString()}</strong></div><div><span>Payment reference</span><strong>{order.paypal_capture_id || 'Not captured'}</strong></div></div>
          <div className="shop-invoice-address"><section><span>Customer</span><strong>{order.customer_name}</strong><small>{order.customer_email}</small><small>{order.customer_phone}</small></section><section><span>Delivery address</span><strong>{order.customer_name}</strong><small>{address.street_address}</small>{address.address_details && <small>{address.address_details}</small>}<small>{address.city}, {address.province} {address.postal_code}</small><small>{address.country}</small></section></div>
          <div className="shop-invoice-table"><div className="shop-invoice-table-head"><span>Specimen</span><span>Qty</span><span>Unit price</span><span>Line total</span></div>
            {order.items.map(item => <div className="shop-invoice-table-row" key={item.order_item_id}><span>{item.shell_name}</span><span>{item.quantity}</span><span>{money(item.unit_price, order.currency)}</span><strong>{money(item.line_total, order.currency)}</strong></div>)}
          </div>
          <div className="shop-invoice-totals"><div><span>Subtotal</span><strong>{money(order.subtotal, order.currency)}</strong></div><div><span>Delivery</span><strong>{money(order.delivery_fee, order.currency)}</strong></div><div className="shop-summary-total"><span>Total</span><strong>{money(order.total, order.currency)}</strong></div><p>Tax is not included because no tax rules are configured.</p></div>
          <footer className="shop-invoice-footer">Thank you for exploring the collection.</footer>
        </article>
        <div className="shop-invoice-actions"><button className="shop-secondary-button" onClick={() => window.print()}><Printer size={15} /> Print invoice</button><button className="shop-primary-button" onClick={() => onNavigate('/orders')}>View order history <ArrowRight size={15} /></button></div>
      </>}
    </main>
  </PageFrame>;
}
