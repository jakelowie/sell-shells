import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { getShopOrders, type ShopOrderSummary } from "../../../shared/api";
import OrderExpiryCountdown from "../OrderExpiryCountdown";
import { BackLink, money, PageFrame, ShopError, ShopLoading, type Navigate } from "./ShopShared";
export function ShopOrdersPage({ onNavigate }: { onNavigate: Navigate }) {
  const [orders, setOrders] = useState<ShopOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getShopOrders()
      .then((result) => setOrders(result.data))
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <PageFrame onNavigate={onNavigate}>
      <main className="shop-main">
        <BackLink onNavigate={onNavigate} />
        <header className="shop-page-heading">
          <span className="store-kicker">YOUR PURCHASES</span>
          <h1>Order history</h1>
          <p>Orders placed in this browser session.</p>
        </header>
        {loading ? (
          <ShopLoading label="Loading your orders…" />
        ) : error ? (
          <ShopError message={error} />
        ) : !orders.length ? (
          <section className="shop-empty">
            <span>
              <ShoppingBag size={22} />
            </span>
            <h2>No orders yet</h2>
            <p>Your completed and pending orders will appear here.</p>
            <button className="shop-primary-button" onClick={() => onNavigate("/customers")}>
              Browse the collection
            </button>
          </section>
        ) : (
          <section className="shop-orders-list">
            {orders.map((order) => (
              <button
                className="shop-order-row"
                key={order.order_id}
                onClick={() => onNavigate(`/orders/${encodeURIComponent(order.order_id)}`)}
              >
                <span>
                  <strong>{order.order_number}</strong>
                  <small>{new Date(order.created_at).toLocaleString()}</small>
                </span>
                <span className="shop-order-status">
                  <span className={`shop-status ${order.payment_status}`}>
                    {order.payment_status}
                  </span>
                  <small>Delivery: {order.fulfillment_status ?? "pending"}</small>
                  <small>Shipping: {money(order.delivery_fee, order.currency)}</small>
                  {order.tracking_number && <small>Tracking {order.tracking_number}</small>}
                  {order.payment_status === "pending" && (
                    <OrderExpiryCountdown expiresAt={order.expires_at} />
                  )}
                </span>
                <strong>{money(order.total, order.currency)}</strong>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
        )}
      </main>
    </PageFrame>
  );
}
