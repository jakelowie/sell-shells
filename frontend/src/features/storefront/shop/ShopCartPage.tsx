import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Shell, ShoppingBag, Trash2 } from "lucide-react";
import {
  getShopCart,
  getShopConfig,
  removeShopCartItem,
  updateShopCartItem,
  type ShopCart,
  type ShopConfig,
} from "../../../shared/api";
import { BackLink, money, PageFrame, ShopError, ShopLoading, type Navigate } from "./ShopShared";
import { cartItemShippingTotal, cartItemsSubtotal, cartShippingTotal } from "./pricing";
export function ShopCartPage({ onNavigate }: { onNavigate: Navigate }) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const items = cart?.items ?? [];
  const subtotal = useMemo(() => cartItemsSubtotal(items), [items]);
  const shippingTotal = useMemo(() => cartShippingTotal(items), [items]);
  const total = subtotal + shippingTotal;

  const refresh = useCallback(async () => {
    setError("");
    try {
      setCart(await getShopCart());
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    getShopConfig()
      .then((result) => setConfig(result.data))
      .catch(() => setConfig(null));
  }, [refresh]);

  const changeQuantity = async (shellId: string, quantity: number) => {
    setSaving(shellId);
    setError("");
    try {
      setCart(await updateShopCartItem(shellId, quantity));
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving("");
    }
  };
  const removeItem = async (shellId: string) => {
    setSaving(shellId);
    setError("");
    try {
      setCart(await removeShopCartItem(shellId));
    } catch (removeError) {
      setError((removeError as Error).message);
    } finally {
      setSaving("");
    }
  };

  return (
    <PageFrame onNavigate={onNavigate}>
      <main className="shop-main">
        <BackLink onNavigate={onNavigate} />
        <header className="shop-page-heading">
          <span className="store-kicker">YOUR SELECTION</span>
          <h1>Shopping bag</h1>
          <p>Review your specimens before continuing to checkout.</p>
        </header>
        {loading ? (
          <ShopLoading label="Loading your bag…" />
        ) : error && !cart ? (
          <ShopError message={error} />
        ) : !cart?.items.length ? (
          <section className="shop-empty">
            <span>
              <ShoppingBag size={22} />
            </span>
            <h2>Your bag is waiting</h2>
            <p>Explore the collection and add a shell that catches your eye.</p>
            <button className="shop-primary-button" onClick={() => onNavigate("/customers")}>
              Explore the collection <ArrowRight size={15} />
            </button>
          </section>
        ) : (
          <>
            {error && <ShopError message={error} />}
            <div className="shop-cart-layout">
              <section className="shop-cart-items" aria-label="Items in your bag">
                {cart.items.map((item) => {
                  const unavailable =
                    Boolean(item.is_deleted) ||
                    item.price == null ||
                    item.available < item.quantity;
                  return (
                    <article className="shop-cart-item" key={item.shell_id}>
                      <div className="shop-item-placeholder">
                        <Shell size={24} strokeWidth={1} />
                      </div>
                      <div className="shop-item-description">
                        <h2>{item.shell_name || "Untitled shell"}</h2>
                        <span>
                          {unavailable ? "Currently unavailable" : `${item.available} available`}
                        </span>
                        <small className="shop-item-shipping">
                          {item.shipping_id
                            ? item.shipping_fee === null
                              ? `${item.shipping_name || "Assigned shipping"} · Fee unavailable`
                              : `${item.shipping_name || "Assigned shipping"} · ${money(item.shipping_fee, config?.currency)} each · ${money(cartItemShippingTotal(item), config?.currency)} total${item.shipping_fee_is_active === false ? " (inactive assignment)" : ""}`
                            : "No shell shipping fee assigned"}
                        </small>
                        <div
                          className="shop-quantity-control"
                          aria-label={`Quantity for ${item.shell_name}`}
                        >
                          <button
                            aria-label="Decrease quantity"
                            disabled={saving === item.shell_id || item.quantity <= 1}
                            onClick={() => void changeQuantity(item.shell_id, item.quantity - 1)}
                          >
                            <Minus size={13} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            aria-label="Increase quantity"
                            disabled={
                              saving === item.shell_id ||
                              item.quantity >= 100 ||
                              item.quantity >= item.available
                            }
                            onClick={() => void changeQuantity(item.shell_id, item.quantity + 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <strong className="shop-line-total">
                        {item.price == null
                          ? "Price unavailable"
                          : money(item.price * item.quantity, config?.currency)}
                      </strong>
                      <button
                        className="shop-remove-item"
                        aria-label={`Remove ${item.shell_name || "shell"}`}
                        disabled={saving === item.shell_id}
                        onClick={() => void removeItem(item.shell_id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  );
                })}
              </section>
              <aside className="shop-summary">
                <h2>Order summary</h2>
                <div>
                  <span>Subtotal</span>
                  <strong>{money(subtotal, config?.currency)}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <strong>{money(shippingTotal, config?.currency)}</strong>
                </div>
                <div className="shop-summary-total">
                  <span>Total</span>
                  <strong>{money(total, config?.currency)}</strong>
                </div>
                <p>Taxes, if applicable, are not calculated because no tax rules are configured.</p>
                <button
                  className="shop-primary-button"
                  disabled={cart.items.some(
                    (item) =>
                      item.is_deleted ||
                      item.price == null ||
                      item.price <= 0 ||
                      item.available < item.quantity ||
                      (item.shipping_id !== null && item.shipping_fee === null),
                  )}
                  onClick={() => onNavigate("/checkout")}
                >
                  Continue to checkout <ArrowRight size={15} />
                </button>
                {!config?.checkout_enabled && (
                  <span className="shop-configuration-note">
                    Checkout is not yet configured by the store.
                  </span>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </PageFrame>
  );
}
