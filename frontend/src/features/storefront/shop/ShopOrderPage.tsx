import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Printer, Shell } from "lucide-react";
import {
  captureShopOrder,
  getShopConfig,
  getShopOrder,
  type DeliveryAddress,
  type ShopConfig,
  type ShopOrder,
} from "../../../shared/api";
import OrderExpiryCountdown, { useOrderExpiry } from "../OrderExpiryCountdown";
import {
  BackLink,
  money,
  PageFrame,
  PayPalButton,
  ShopError,
  ShopLoading,
  type Navigate,
} from "./ShopShared";

const emptyDeliveryAddress: DeliveryAddress = {
  street_address: "",
  city: "",
  province: "",
  postal_code: "",
  country: "",
  address_details: "",
};
export function ShopOrderPage({ orderId, onNavigate }: { orderId: string; onNavigate: Navigate }) {
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const orderExpiry = useOrderExpiry(order?.expires_at ?? null);
  const refresh = useCallback(async () => {
    setError("");
    try {
      setOrder(await getShopOrder(orderId));
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    void refresh();
    getShopConfig()
      .then((result) => setConfig(result.data))
      .catch(() => setConfig(null));
  }, [refresh]);

  const retryOrderPayment = useCallback(async () => {
    if (!order?.paypal_order_id)
      throw new Error("This order does not have an active PayPal order.");
    return order.paypal_order_id;
  }, [order]);
  const completePayment = useCallback(
    async (paypalOrderId: string) => {
      if (!order || paypalOrderId !== order.paypal_order_id)
        throw new Error("PayPal returned a different order reference.");
      setPaymentError("");
      try {
        setOrder(await captureShopOrder(order.order_id));
      } catch (paymentFailure) {
        setPaymentError((paymentFailure as Error).message);
        throw paymentFailure;
      }
    },
    [order],
  );
  const paypalError = useCallback(
    (paymentFailure: unknown) =>
      setPaymentError((paymentFailure as Error)?.message || "PayPal payment failed."),
    [],
  );

  const address = order?.delivery_address ?? emptyDeliveryAddress;
  return (
    <PageFrame onNavigate={onNavigate}>
      <main className="shop-main shop-invoice-main">
        <BackLink onNavigate={onNavigate} />
        {loading ? (
          <ShopLoading label="Retrieving your order…" />
        ) : error ? (
          <ShopError message={error} />
        ) : (
          order && (
            <>
              <header className="shop-page-heading">
                <span className="store-kicker">ORDER CONFIRMATION</span>
                <h1>
                  {order.payment_status === "captured"
                    ? "Thank you for your order"
                    : "Order details"}
                </h1>
                <p>Your order reference is {order.order_number}.</p>
              </header>
              {paymentError && <ShopError message={paymentError} />}
              {order.payment_status === "pending" && (
                <section className="shop-pending-payment">
                  <strong>Payment pending</strong>
                  <span>
                    This order has not been paid. Complete payment before the reservation expires.
                  </span>
                  <OrderExpiryCountdown expiresAt={order.expires_at} />
                  {!orderExpiry.expired && config && (
                    <PayPalButton
                      config={config}
                      createOrder={retryOrderPayment}
                      onPaid={completePayment}
                      onError={paypalError}
                      onCancel={() => {
                        console.info("[checkout] Buyer cancelled PayPal checkout", {
                          orderId: order.order_id,
                        });
                        setPaymentError(
                          "Payment was cancelled. This order remains unpaid until completed or its reservation expires.",
                        );
                      }}
                    />
                  )}
                  {orderExpiry.expired && (
                    <span className="order-expiry expired">
                      This reservation has expired. Start a new checkout from your bag.
                    </span>
                  )}
                </section>
              )}
              <article className="shop-invoice" id="shop-invoice">
                <div className="shop-invoice-top">
                  <div className="shop-invoice-brand">
                    <Shell size={19} /> craftshellhouse<small>THE SHELL COLLECTION</small>
                  </div>
                  <div>
                    <span className={`shop-status ${order.payment_status}`}>
                      {order.payment_status}
                    </span>
                    <h2>Invoice</h2>
                  </div>
                </div>
                <div className="shop-invoice-meta">
                  <div>
                    <span>Order number</span>
                    <strong>{order.order_number}</strong>
                  </div>
                  <div>
                    <span>Order date</span>
                    <strong>{new Date(order.created_at).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Payment reference</span>
                    <strong>{order.paypal_capture_id || "Not captured"}</strong>
                  </div>
                </div>
                <section className="order-fulfillment">
                  <h3>Delivery status</h3>
                  <div className="order-lifecycle">
                    {["pending", "preparing", "shipped", "delivered"].map((stage, index) => (
                      <span
                        className={
                          (order.fulfillment_status ?? "pending") === stage
                            ? "current"
                            : ["pending", "preparing", "shipped", "delivered"].indexOf(
                                  order.fulfillment_status ?? "pending",
                                ) > index
                              ? "complete"
                              : ""
                        }
                        key={stage}
                      >
                        {stage}
                      </span>
                    ))}
                  </div>
                  {order.fulfillment_status === "cancelled" && <strong>Cancelled</strong>}
                  {order.tracking_number && (
                    <p>
                      Tracking number: <strong>{order.tracking_number}</strong>
                    </p>
                  )}
                  {order.estimated_delivery_at && (
                    <p>
                      Estimated delivery by{" "}
                      {new Date(order.estimated_delivery_at).toLocaleDateString()}
                    </p>
                  )}
                </section>
                <div className="shop-invoice-address">
                  <section>
                    <span>Customer</span>
                    <strong>{order.customer_name}</strong>
                    <small>{order.customer_email}</small>
                    <small>{order.customer_phone}</small>
                  </section>
                  <section>
                    <span>Delivery address</span>
                    <strong>{order.customer_name}</strong>
                    <small>{address.street_address}</small>
                    {address.address_details && <small>{address.address_details}</small>}
                    <small>
                      {address.city}, {address.province} {address.postal_code}
                    </small>
                    <small>{address.country}</small>
                  </section>
                </div>
                <div className="shop-invoice-table">
                  <div className="shop-invoice-table-head">
                    <span>Specimen</span>
                    <span>Qty</span>
                    <span>Unit price</span>
                    <span>Line total</span>
                  </div>
                  {order.items.map((item) => (
                    <div className="shop-invoice-table-row" key={item.order_item_id}>
                      <span>
                        {item.shell_name}
                        {item.shipping_name && (
                          <small className="shop-summary-shipping">
                            {item.shipping_name}:{" "}
                            {money(item.unit_shipping_fee ?? 0, order.currency)} each
                            {item.shipping_total !== null &&
                              ` · ${money(item.shipping_total, order.currency)} for ${item.quantity}`}
                          </small>
                        )}
                      </span>
                      <span>{item.quantity}</span>
                      <span>{money(item.unit_price, order.currency)}</span>
                      <strong>{money(item.line_total, order.currency)}</strong>
                    </div>
                  ))}
                </div>
                <div className="shop-invoice-totals">
                  <div>
                    <span>Product subtotal</span>
                    <strong>{money(order.subtotal, order.currency)}</strong>
                  </div>
                  {order.discount_amount ? (
                    <div>
                      <span>Discount {order.discount_code ? `(${order.discount_code})` : ""}</span>
                      <strong>−{money(order.discount_amount, order.currency)}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Delivery</span>
                    <strong>{money(order.delivery_fee, order.currency)}</strong>
                  </div>
                  <div className="shop-summary-total">
                    <span>Total</span>
                    <strong>{money(order.total, order.currency)}</strong>
                  </div>
                  <p>Tax is not included because no tax rules are configured.</p>
                </div>
                <footer className="shop-invoice-footer">
                  Thank you for exploring the collection.
                </footer>
              </article>
              <div className="shop-invoice-actions">
                <button className="shop-secondary-button" onClick={() => window.print()}>
                  <Printer size={15} /> Print invoice
                </button>
                <button className="shop-primary-button" onClick={() => onNavigate("/orders")}>
                  View order history <ArrowRight size={15} />
                </button>
              </div>
            </>
          )
        )}
      </main>
    </PageFrame>
  );
}
