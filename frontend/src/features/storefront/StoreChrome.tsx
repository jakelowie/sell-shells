import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowRight, Shell, ShoppingBag } from "lucide-react";
import { getShopCart, getShopConfig } from "../../shared/api";
import { useAuth } from "../auth/AuthProvider";

export function StoreHeader({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const isStaff = role === "admin" || role === "superadmin";
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<
    Array<{ shell_id: string; shell_name: string | null; quantity: number; price: number | null }>
  >([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadCount = () => {
      void getShopCart()
        .then((cart) => {
          if (active) {
            setCartCount(cart.items.reduce((count, item) => count + item.quantity, 0));
            setCartItems(cart.items);
          }
        })
        .catch(() => {
          if (active) {
            setCartCount(0);
            setCartItems([]);
          }
        });
    };
    loadCount();
    void getShopConfig()
      .then((result) => {
        if (active) setCurrency(result.data.currency);
      })
      .catch(() => setCurrency(null));
    window.addEventListener("shop-cart-updated", loadCount);
    return () => {
      active = false;
      window.removeEventListener("shop-cart-updated", loadCount);
    };
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <header className="store-header">
      <a
        href="/customers"
        className="store-brand"
        onClick={(event) => navigate(event, "/customers")}
      >
        <span className="store-brand-mark">
          <Shell size={21} />
        </span>
        <span>
          craftshellhouse<small>THE SHELL COLLECTION</small>
        </span>
      </a>
      <nav className="store-header-nav">
        <a
          href="/customers#collection"
          onClick={(event) => {
            if (window.location.pathname !== "/customers") navigate(event, "/customers");
          }}
        >
          The collection
        </a>
        <a href="/customers#about">Our approach</a>
        <a href="/orders" onClick={(event) => navigate(event, "/orders")}>
          Orders
        </a>
        <a href="/feedback" onClick={(event) => navigate(event, "/feedback")}>
          Feedback
        </a>
        <a href="/contact" onClick={(event) => navigate(event, "/contact")}>
          Contact
        </a>
      </nav>
      <div className="store-header-actions">
        <a
          className="header-collection-link"
          href="/customers#collection"
          onClick={(event) => {
            if (window.location.pathname !== "/customers") navigate(event, "/customers");
          }}
        >
          Explore <ArrowRight size={14} />
        </a>
        <a
          className="store-cart-link"
          href="/cart"
          aria-expanded={cartOpen}
          aria-label={`Shopping bag, ${cartCount} items`}
          onClick={(event) => {
            event.preventDefault();
            setCartOpen((v) => !v);
          }}
        >
          <ShoppingBag size={14} />
          <span>Bag</span>
          <b>{cartCount}</b>
        </a>
        {cartOpen && (
          <aside className="header-cart-widget" aria-label="Shopping bag summary">
            <header>
              <strong>Your bag · {cartCount}</strong>
              <button aria-label="Close bag" onClick={() => setCartOpen(false)}>
                ×
              </button>
            </header>
            {cartItems.length ? (
              <>
                {cartItems.slice(0, 4).map((item) => (
                  <div className="header-cart-row" key={item.shell_id}>
                    <span>
                      {item.shell_name || "Shell"} × {item.quantity}
                    </span>
                    <strong>
                      {item.price == null
                        ? "Price unavailable"
                        : currency
                          ? new Intl.NumberFormat(undefined, {
                              style: "currency",
                              currency,
                            }).format(item.price * item.quantity)
                          : `${item.price * item.quantity} (currency not set)`}
                    </strong>
                  </div>
                ))}
                <a href="/cart" onClick={(event) => navigate(event, "/cart")}>
                  View full bag & checkout <ArrowRight size={13} />
                </a>
              </>
            ) : (
              <p>Your bag is empty.</p>
            )}
          </aside>
        )}
        {isStaff ? (
          <>
            <a
              className="store-signout"
              href="/admin"
              onClick={(event) => navigate(event, "/admin")}
            >
              Admin
            </a>
            <button
              className="store-signout"
              title={user?.email || "Sign out"}
              onClick={() =>
                void signOut().catch((error) => window.alert((error as Error).message))
              }
            >
              Sign out
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}

export function StoreFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <footer id="about" className="store-footer">
      <a
        href="/customers"
        className="footer-brand"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("/customers");
        }}
      >
        <Shell size={17} /> craftshellhouse
      </a>
      <span>Natural forms, thoughtfully collected.</span>
      <span className="store-footer-links">
        <a
          href="/return-policy"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/return-policy");
          }}
        >
          Return policy
        </a>
        <a
          href="/returns/request"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/returns/request");
          }}
        >
          Request a return
        </a>
        <a
          href="/payment-delivery"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/payment-delivery");
          }}
        >
          Payment & delivery
        </a>
        <span>© craftshellhouse</span>
      </span>
    </footer>
  );
}
