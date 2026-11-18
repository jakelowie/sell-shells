import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import {
  captureShopOrder,
  createShopOrder,
  getShopCart,
  getShopConfig,
  validateDiscount,
  type DeliveryAddress,
  type ShopCart,
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
import {
  cartItemShippingTotal,
  cartItemsSubtotal,
  cartShippingTotal,
  orderGrandTotal,
} from "./pricing";
type CheckoutValues = { name: string; email: string; phone: string; address: DeliveryAddress };
const initialCheckout: CheckoutValues = {
  name: "",
  email: "",
  phone: "",
  address: {
    street_address: "",
    city: "",
    province: "",
    postal_code: "",
    country: "",
    address_details: "",
  },
};

export function ShopCheckoutPage({ onNavigate }: { onNavigate: Navigate }) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [values, setValues] = useState(initialCheckout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [createdOrder, setCreatedOrder] = useState<ShopOrder | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<{ code: string; discount_amount: number } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const cartItems = cart?.items ?? [];
  const subtotal = cartItemsSubtotal(cartItems);
  const previewShippingTotal = cartShippingTotal(cartItems);
  const displaySubtotal = createdOrder?.subtotal ?? subtotal;
  const displayShippingTotal = createdOrder?.delivery_fee ?? previewShippingTotal;
  const displayDiscount = createdOrder?.discount_amount ?? discount?.discount_amount ?? 0;
  const total =
    createdOrder?.total ??
    orderGrandTotal(subtotal, previewShippingTotal, discount?.discount_amount ?? 0);
  const checkoutExpiry = useOrderExpiry(createdOrder?.expires_at ?? null);

  useEffect(() => {
    let active = true;
    Promise.all([getShopCart(), getShopConfig()])
      .then(([nextCart, nextConfig]) => {
        if (!active) return;
        setCart(nextCart);
        setConfig(nextConfig.data);
      })
      .catch((loadError) => {
        if (active) setError((loadError as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const createPaypalOrder = useCallback(async () => {
    if (!formRef.current?.reportValidity())
      throw new Error("Complete the required customer and delivery information.");
    if (createdOrder?.paypal_order_id) return createdOrder.paypal_order_id;
    setBusy(true);
    setOrderError("");
    try {
      const order = await createShopOrder({
        idempotency_key: idempotencyKey,
        discount_code: discount?.code,
        customer: { name: values.name, email: values.email, phone: values.phone },
        delivery_address: values.address,
      });
      if (!order.paypal_order_id) throw new Error("PayPal did not return an order reference.");
      console.info("[checkout] PayPal order ready", {
        orderId: order.order_id,
        paypalOrderId: order.paypal_order_id,
      });
      setCreatedOrder(order);
      return order.paypal_order_id;
    } catch (createError) {
      console.error("[checkout] Order creation failed", {
        error: (createError as Error)?.message || "Unknown error",
      });
      setOrderError((createError as Error).message);
      throw createError;
    } finally {
      setBusy(false);
    }
  }, [createdOrder, discount, idempotencyKey, values]);

  const applyDiscount = async () => {
    setDiscountError("");
    try {
      const result = await validateDiscount(discountCode, subtotal);
      setDiscount(result.data);
    } catch (error) {
      setDiscount(null);
      setDiscountError((error as Error).message);
    }
  };

  const completePayment = useCallback(
    async (paypalOrderId: string) => {
      if (!createdOrder || paypalOrderId !== createdOrder.paypal_order_id)
        throw new Error("PayPal returned a different order than the one created by this checkout.");
      console.info("[checkout] Buyer approved PayPal order", {
        orderId: createdOrder.order_id,
        paypalOrderId,
      });
      setBusy(true);
      setOrderError("");
      try {
        const paid = await captureShopOrder(createdOrder.order_id);
        onNavigate(`/orders/${encodeURIComponent(paid.order_id)}`);
      } catch (captureError) {
        console.error("[checkout] Capture request failed", {
          orderId: createdOrder.order_id,
          error: (captureError as Error)?.message || "Unknown error",
        });
        setOrderError((captureError as Error).message);
        throw captureError;
      } finally {
        setBusy(false);
      }
    },
    [createdOrder, onNavigate],
  );

  const payPalError = useCallback((paymentError: unknown) => {
    console.error("[checkout] PayPal SDK error", {
      error: (paymentError as Error)?.message || "Unknown error",
    });
    setOrderError(
      (paymentError as Error)?.message || "PayPal could not complete checkout. You can try again.",
    );
  }, []);

  const setAddress = (field: keyof DeliveryAddress, value: string) =>
    setValues((current) => ({ ...current, address: { ...current.address, [field]: value } }));
  const submitNoop = (event: FormEvent) => event.preventDefault();
  const unavailable =
    !cart?.items.length ||
    cart.items.some(
      (item) =>
        item.is_deleted ||
        item.price == null ||
        item.price <= 0 ||
        item.available < item.quantity ||
        (item.shipping_id !== null && item.shipping_fee === null),
    );
  const shippingFeeUnavailable = cartItems.some(
    (item) => item.shipping_id !== null && item.shipping_fee === null,
  );

  return (
    <PageFrame onNavigate={onNavigate}>
      <main className="shop-main">
        <BackLink onNavigate={onNavigate} />
        <header className="shop-page-heading">
          <span className="store-kicker">SECURE CHECKOUT</span>
          <h1>Your delivery details</h1>
          <p>No customer account is needed. Your confirmation is saved to this browser session.</p>
        </header>
        {loading ? (
          <ShopLoading label="Preparing checkout…" />
        ) : error ? (
          <ShopError message={error} />
        ) : !cart?.items.length ? (
          <section className="shop-empty">
            <h2>Your bag is empty</h2>
            <p>Add a shell before checking out.</p>
            <button className="shop-primary-button" onClick={() => onNavigate("/customers")}>
              Browse the collection
            </button>
          </section>
        ) : (
          <div className="shop-checkout-layout">
            <form className="shop-checkout-form" ref={formRef} onSubmit={submitNoop}>
              <section className="shop-form-section">
                <h2>Contact information</h2>
                <label className="shop-field">
                  Recipient full name
                  <input
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={values.name}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <div className="shop-field-grid">
                  <label className="shop-field">
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={values.email}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </label>
                  <label className="shop-field">
                    Contact number
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={7}
                      maxLength={30}
                      pattern="\+?[0-9().\-\s]+"
                      value={values.phone}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </section>
              <section className="shop-form-section">
                <h2>Delivery address</h2>
                <label className="shop-field">
                  Street address and building number
                  <input
                    autoComplete="street-address"
                    required
                    minLength={3}
                    maxLength={200}
                    value={values.address.street_address}
                    onChange={(event) => setAddress("street_address", event.target.value)}
                  />
                </label>
                <div className="shop-field-grid">
                  <label className="shop-field">
                    City or municipality
                    <input
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={100}
                      value={values.address.city}
                      onChange={(event) => setAddress("city", event.target.value)}
                    />
                  </label>
                  <label className="shop-field">
                    Province or state
                    <input
                      autoComplete="address-level1"
                      required
                      minLength={2}
                      maxLength={100}
                      value={values.address.province}
                      onChange={(event) => setAddress("province", event.target.value)}
                    />
                  </label>
                  <label className="shop-field">
                    Postal code
                    <input
                      autoComplete="postal-code"
                      required
                      minLength={2}
                      maxLength={20}
                      value={values.address.postal_code}
                      onChange={(event) => setAddress("postal_code", event.target.value)}
                    />
                  </label>
                  <label className="shop-field">
                    Country
                    <input
                      autoComplete="country-name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={values.address.country}
                      onChange={(event) => setAddress("country", event.target.value)}
                    />
                  </label>
                </div>
                <label className="shop-field">
                  Address details or delivery instructions <span>(optional)</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={values.address.address_details}
                    onChange={(event) => setAddress("address_details", event.target.value)}
                  />
                </label>
              </section>
              {orderError && <ShopError message={orderError} />}
              {createdOrder?.payment_status === "pending" && (
                <div className="shop-pending-payment">
                  <strong>Payment pending</strong>
                  <span>Complete payment before this reservation expires.</span>
                  <OrderExpiryCountdown expiresAt={createdOrder.expires_at} />
                </div>
              )}
              {!config?.checkout_enabled && (
                <p className="shop-configuration-note">
                  PayPal checkout is unavailable until the store configures its currency and PayPal
                  credentials.
                </p>
              )}
              {config &&
              !unavailable &&
              createdOrder?.payment_status === "pending" &&
              checkoutExpiry.expired ? (
                <ShopError message="This payment reservation has expired. Return to your bag to start a new checkout." />
              ) : (
                config &&
                !unavailable && (
                  <PayPalButton
                    config={config}
                    createOrder={createPaypalOrder}
                    onPaid={completePayment}
                    onError={payPalError}
                    onCancel={() => {
                      console.info("[checkout] Buyer cancelled PayPal checkout", {
                        orderId: createdOrder?.order_id ?? null,
                      });
                      setOrderError(
                        "Payment was cancelled. The pending order remains available in order history until its reservation expires.",
                      );
                    }}
                  />
                )
              )}
              {busy && (
                <p className="shop-payment-progress">
                  <LoaderCircle size={15} className="spin" /> Contacting PayPal securely…
                </p>
              )}
              {unavailable && (
                <ShopError
                  message={
                    shippingFeeUnavailable
                      ? "A shell has an assigned shipping record without a valid fee. Please contact the store before placing this order."
                      : "One or more cart items are unavailable or exceed the current stock. Return to your bag to adjust quantities."
                  }
                />
              )}
            </form>
            <aside className="shop-summary shop-checkout-summary">
              <h2>Order summary</h2>
              <div className="checkout-discount">
                <label htmlFor="discount-code">Discount code</label>
                <div>
                  <input
                    id="discount-code"
                    value={discountCode}
                    onChange={(event) => {
                      setDiscountCode(event.target.value);
                      setDiscount(null);
                    }}
                    disabled={Boolean(createdOrder)}
                  />
                  <button
                    type="button"
                    onClick={() => void applyDiscount()}
                    disabled={!discountCode.trim() || Boolean(createdOrder)}
                  >
                    Apply
                  </button>
                  {discount && (
                    <button
                      type="button"
                      onClick={() => {
                        setDiscount(null);
                        setDiscountCode("");
                        setDiscountError("");
                      }}
                      disabled={Boolean(createdOrder)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {discountError && <small role="alert">{discountError}</small>}
              </div>
              {cart.items.map((item) => {
                const orderItem = createdOrder?.items.find(
                  (saved) => saved.shell_id === item.shell_id,
                );
                const itemShippingTotal = orderItem?.shipping_total ?? cartItemShippingTotal(item);
                const shippingName = orderItem?.shipping_name ?? item.shipping_name;
                const unitShippingFee = orderItem?.unit_shipping_fee ?? item.shipping_fee;
                return (
                  <div className="shop-summary-line" key={item.shell_id}>
                    <span>
                      {item.shell_name || "Untitled shell"} <small>× {item.quantity}</small>
                      <small className="shop-summary-shipping">
                        {shippingName
                          ? `${shippingName} · ${money(itemShippingTotal, config?.currency)}${item.shipping_fee_is_active === false && !orderItem ? " (inactive assignment)" : ""}`
                          : "No shell shipping fee assigned"}
                        {unitShippingFee != null && item.quantity > 1
                          ? ` · ${money(unitShippingFee, config?.currency)} each`
                          : ""}
                      </small>
                    </span>
                    <strong>{money((item.price ?? 0) * item.quantity, config?.currency)}</strong>
                  </div>
                );
              })}
              <div>
                <span>Items subtotal</span>
                <strong>{money(displaySubtotal, config?.currency)}</strong>
              </div>
              {displayDiscount > 0 && (
                <div>
                  <span>
                    Discount{" "}
                    {createdOrder?.discount_code
                      ? `(${createdOrder.discount_code})`
                      : discount?.code
                        ? `(${discount.code})`
                        : ""}
                  </span>
                  <strong>−{money(displayDiscount, config?.currency)}</strong>
                </div>
              )}
              <div>
                <span>Shipping</span>
                <strong>{money(displayShippingTotal, config?.currency)}</strong>
              </div>
              <div className="shop-summary-total">
                <span>Total</span>
                <strong>{money(total, config?.currency)}</strong>
              </div>
              <p>The server will verify prices and stock again before creating the PayPal order.</p>
            </aside>
          </div>
        )}
      </main>
    </PageFrame>
  );
}
