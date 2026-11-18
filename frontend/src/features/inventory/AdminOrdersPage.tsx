import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  LogOut,
  PackageCheck,
  RotateCw,
  Shell,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  getAdminOrder,
  getAdminOrderHistory,
  listAdminOrders,
  updateAdminFulfillment,
  type AdminOrderSummary,
} from "../../shared/api/admin-orders";
import { getAdminCollection } from "../../shared/api/admin-commerce";
import type { ShopOrder } from "../../shared/api/types";
import OrderExpiryCountdown from "../storefront/OrderExpiryCountdown";

const PAGE_SIZE = 20;
const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

export default function AdminOrdersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [fulfillment, setFulfillment] = useState("preparing");
  const [courierId, setCourierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminOrders(PAGE_SIZE, offset);
      setOrders(result.data);
      setTotal(result.pagination.total);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offset]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    void getAdminCollection("shipping/couriers")
      .then((r) => setCouriers(r.data))
      .catch(() => setCouriers([]));
  }, []);

  const openOrder = async (id: string, nextStatus?: string) => {
    setDetailLoading(true);
    setError("");
    setStatusNote("");
    try {
      const [detail, audit] = await Promise.all([getAdminOrder(id), getAdminOrderHistory(id)]);
      setSelected(detail.data);
      setHistory(audit.data);
      setFulfillment(
        nextStatus ??
          (detail.data.fulfillment_status === "preparing"
            ? "shipped"
            : detail.data.fulfillment_status === "shipped"
              ? "delivered"
              : "preparing"),
      );
      setCourierId("");
      setTrackingNumber("");
      setDeliveryDate("");
      if (nextStatus === "shipped") {
        setStatusNote("Add a courier and tracking number below to mark this order as shipped.");
        window.requestAnimationFrame(() => {
          document
            .getElementById("admin-fulfillment")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } catch (detailError) {
      setError((detailError as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };
  const currentFulfillment = selected?.fulfillment_status ?? "pending";

  const updateListFulfillment = async (order: AdminOrderSummary, nextStatus: string) => {
    if (nextStatus === "shipped") {
      await openOrder(order.order_id, nextStatus);
      return;
    }

    setSavingStatusId(order.order_id);
    setError("");
    setStatusNote("");
    try {
      await updateAdminFulfillment(order.order_id, { status: nextStatus });
      setOrders((current) =>
        current.map((item) =>
          item.order_id === order.order_id
            ? { ...item, fulfillment_status: nextStatus as AdminOrderSummary["fulfillment_status"] }
            : item,
        ),
      );
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[order.order_id];
        return next;
      });
      if (selected?.order_id === order.order_id) await openOrder(order.order_id);
    } catch (statusError) {
      setError((statusError as Error).message);
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <div className="admin-orders-shell">
      <header className="admin-orders-topbar">
        <a
          className="admin-orders-brand"
          href="/admin"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/admin");
          }}
        >
          <Shell size={19} />
          craftshellhouse
        </a>

        <span>
          {user?.email} · {role}
        </span>

        <button
          className="auth-signout"
          onClick={() =>
            void signOut().catch((signOutError) => setError((signOutError as Error).message))
          }
        >
          <LogOut size={15} />
          Sign out
        </button>
      </header>

      <main className="admin-orders-main">
        <button className="admin-orders-back" onClick={() => onNavigate("/admin")}>
          <ArrowLeft size={14} />
          Inventory
        </button>

        <div className="admin-orders-heading">
          <div>
            <span className="eyebrow">STORE / ORDERS</span>
            <h1>Customer orders</h1>
            <p>Review customer details, payment status, and pending reservations.</p>
          </div>

          <button
            className="admin-orders-refresh"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RotateCw size={14} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <CircleAlert size={17} />
            <span>{error}</span>
          </div>
        )}

        {statusNote && <div className="admin-order-status-note">{statusNote}</div>}

        {detailLoading && (
          <div className="loading">
            <LoaderCircle className="spin" size={21} />
            Loading order details…
          </div>
        )}

        {selected && (
          <section className="admin-order-detail">
            <div className="admin-order-detail-heading">
              <div>
                <small>ORDER DETAILS</small>
                <h2>{selected!.order_number}</h2>
              </div>

              <button onClick={() => setSelected(null)} aria-label="Close order details">
                ×
              </button>
            </div>

            <div className="admin-order-detail-grid">
              <div>
                <span>Customer</span>
                <strong>{selected!.customer_name}</strong>
                <small>{selected!.customer_email}</small>
                <small>{selected!.customer_phone}</small>
              </div>

              <div>
                <span>Payment</span>
                <strong className={`shop-status ${selected!.payment_status}`}>
                  {selected!.payment_status}
                </strong>
                <small>Order status: {selected!.order_status}</small>

                {selected!.payment_status === "pending" && (
                  <OrderExpiryCountdown expiresAt={selected!.expires_at} />
                )}
              </div>

              <div>
                <span>Delivery address</span>
                <strong>{selected!.delivery_address.street_address}</strong>
                <small>
                  {selected!.delivery_address.city}, {selected!.delivery_address.province}{" "}
                  {selected!.delivery_address.postal_code}
                </small>
                <small>{selected!.delivery_address.country}</small>

                {selected!.delivery_address.address_details && (
                  <small>{selected!.delivery_address.address_details}</small>
                )}
              </div>
            </div>

            <div className="admin-order-items">
              {selected!.items.map((item) => (
                <div key={item.order_item_id}>
                  <span>
                    {item.shell_name} × {item.quantity}
                  </span>
                  <strong>{formatMoney(item.line_total, selected!.currency)}</strong>
                </div>
              ))}

              <div>
                <span>Total</span>
                <strong>{formatMoney(selected!.total, selected!.currency)}</strong>
              </div>
            </div>
          </section>
        )}

        <section className="admin-orders-table-panel">
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spin" size={21} />
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="admin-orders-empty">
              <PackageCheck size={24} />
              <strong>No orders yet</strong>
              <span>Customer checkouts will appear here.</span>
            </div>
          ) : (
            <div className="admin-orders-table-wrap">
              <table className="admin-orders-table">
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>PLACED</th>
                    <th>PAYMENT</th>
                    <th>FULFILLMENT</th>
                    <th>TOTAL</th>
                    <th>EXPIRY</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id} onClick={() => void openOrder(order.order_id)}>
                      <td>
                        <strong>{order.order_number}</strong>
                        <small>{order.order_status}</small>
                      </td>

                      <td>
                        <strong>{order.customer_name}</strong>
                        <small>{order.customer_email}</small>
                      </td>

                      <td>{new Date(order.created_at).toLocaleString()}</td>

                      <td>
                        <span className={`shop-status ${order.payment_status}`}>
                          {order.payment_status}
                        </span>
                      </td>

                      <td onClick={(event) => event.stopPropagation()}>
                        {(() => {
                          const current = order.fulfillment_status ?? "pending";
                          const transitions: Record<string, string[]> = {
                            pending: ["preparing", "cancelled"],
                            preparing: ["shipped", "cancelled"],
                            shipped: ["delivered"],
                          };
                          const options = (transitions[current] ?? []).filter(
                            (status) =>
                              status === "cancelled" || order.payment_status === "captured",
                          );

                          return (
                            <div className="admin-order-status-control">
                              <span className={`shop-status ${current}`}>{current}</span>
                              {options.length > 0 && (
                                <div>
                                  <select
                                    aria-label={`Next fulfillment status for ${order.order_number}`}
                                    value={statusDrafts[order.order_id] ?? ""}
                                    onChange={(event) =>
                                      setStatusDrafts((drafts) => ({
                                        ...drafts,
                                        [order.order_id]: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">Update status…</option>
                                    {options.map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    disabled={
                                      !statusDrafts[order.order_id] ||
                                      savingStatusId === order.order_id ||
                                      detailLoading
                                    }
                                    onClick={() =>
                                      void updateListFulfillment(
                                        order,
                                        statusDrafts[order.order_id],
                                      )
                                    }
                                  >
                                    {savingStatusId === order.order_id ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td>
                        <strong>{formatMoney(order.total, order.currency)}</strong>
                      </td>

                      <td>
                        {order.payment_status === "pending" ? (
                          <OrderExpiryCountdown expiresAt={order.expires_at} />
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-orders-pagination">
            <span>
              {total
                ? `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`
                : "0 orders"}
            </span>

            <div>
              <button
                aria-label="Previous page"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              >
                <ChevronLeft size={17} />
              </button>

              <button
                aria-label="Next page"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          {selected && (
            <section className="admin-fulfillment" id="admin-fulfillment">
              <h3>Fulfillment · {selected!.fulfillment_status ?? "pending"}</h3>
              <div className="admin-fulfillment-form">
                <label>
                  Next status
                  <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>
                    {(currentFulfillment === "pending"
                      ? ["preparing", "cancelled"]
                      : currentFulfillment === "preparing"
                        ? ["shipped", "cancelled"]
                        : currentFulfillment === "shipped"
                          ? ["delivered"]
                          : []
                    ).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                {fulfillment === "shipped" && (
                  <>
                    <label>
                      Courier
                      <select
                        required
                        value={courierId}
                        onChange={(e) => setCourierId(e.target.value)}
                      >
                        <option value="">Choose courier</option>
                        {couriers
                          .filter((item) => item.active)
                          .map((item) => (
                            <option key={item.courier_id} value={item.courier_id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Tracking number
                      <input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                    </label>
                    <label>
                      Estimated delivery
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <label>
                  Remarks
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </label>
                <button
                  disabled={
                    !fulfillment ||
                    !["pending", "preparing", "shipped"].includes(currentFulfillment) ||
                    selected!.payment_status !== "captured" ||
                    (fulfillment === "shipped" && (!courierId || !trackingNumber))
                  }
                  onClick={() => {
                    void updateAdminFulfillment(selected!.order_id, {
                      status: fulfillment,
                      remarks,
                      courier_id: courierId || undefined,
                      tracking_number: trackingNumber || undefined,
                      estimated_delivery_at: deliveryDate
                        ? new Date(`${deliveryDate}T12:00:00`).toISOString()
                        : undefined,
                    })
                      .then(async () => {
                        setStatusDrafts((currentDrafts) => {
                          const next = { ...currentDrafts };
                          delete next[selected!.order_id];
                          return next;
                        });
                        await openOrder(selected!.order_id);
                        await refresh();
                      })
                      .catch((e) => setError((e as Error).message));
                  }}
                >
                  Update fulfillment
                </button>
              </div>
              {selected!.tracking_number && <p>Tracking: {selected!.tracking_number}</p>}
              {selected!.estimated_delivery_at && (
                <p>
                  Est. delivery: {new Date(selected!.estimated_delivery_at).toLocaleDateString()}
                </p>
              )}
              <h4>Status history</h4>
              {history.map((item) => (
                <p key={item.history_id}>
                  {item.previous_status ?? "new"} → {item.new_status} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                  {item.remarks ? ` · ${item.remarks}` : ""}
                </p>
              ))}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
