import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import type { ShopConfig } from "../../../shared/api";
import { StoreFooter, StoreHeader } from "../StoreChrome";
export type Navigate = (path: string) => void;
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
declare global {
  interface Window {
    paypal?: PaypalNamespace;
  }
}

let paypalSdkLoad: Promise<PaypalNamespace> | undefined;

function loadPaypalSdk(clientId: string, currency: string): Promise<PaypalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkLoad) return paypalSdkLoad;
  const loadPromise: Promise<PaypalNamespace> = new Promise<PaypalNamespace>((resolve, reject) => {
    const existing = document.getElementById("sell-shells-paypal-sdk") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const loaded = () =>
      window.paypal
        ? resolve(window.paypal)
        : reject(new Error("PayPal checkout did not finish loading."));
    const failed = () =>
      reject(
        new Error(
          "PayPal checkout could not be loaded. Check your network and sandbox configuration.",
        ),
      );
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = "sell-shells-paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
      script.async = true;
      document.body.appendChild(script);
    }
  }).catch((error: unknown): never => {
    paypalSdkLoad = undefined;
    throw error;
  });
  paypalSdkLoad = loadPromise;
  return loadPromise;
}

export function PayPalButton({
  config,
  createOrder,
  onPaid,
  onCancel,
  onError,
}: {
  config: ShopConfig;
  createOrder: () => Promise<string>;
  onPaid: (orderId: string) => Promise<void>;
  onCancel?: () => void;
  onError: (error: unknown) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // PayPal owns a live button/popup lifecycle. Keep its instance mounted while
  // checkout state changes (for example, when createOrder saves the local order).
  const callbacks = useRef({ createOrder, onPaid, onCancel, onError });
  callbacks.current = { createOrder, onPaid, onCancel, onError };
  useEffect(() => {
    if (
      !config.paypal_client_id ||
      !config.currency ||
      !config.checkout_enabled ||
      !container.current
    )
      return;
    let active = true;
    let buttons: PaypalButtons | undefined;
    console.info("[checkout] Initializing PayPal buttons", {
      mode: config.paypal_mode,
      currency: config.currency,
    });
    void loadPaypalSdk(config.paypal_client_id, config.currency)
      .then((paypal) => {
        if (!active || !container.current) return;
        buttons = paypal.Buttons({
          createOrder: () => callbacks.current.createOrder(),
          onApprove: async (data) => {
            await callbacks.current.onPaid(data.orderID);
          },
          onCancel: () => callbacks.current.onCancel?.(),
          onError: (error) => callbacks.current.onError(error),
        });
        return buttons.render(container.current);
      })
      .catch((error) => {
        console.error("[checkout] PayPal SDK initialization failed", {
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        callbacks.current.onError(error);
      });
    return () => {
      active = false;
      buttons?.close?.();
    };
  }, [config.checkout_enabled, config.currency, config.paypal_client_id]);
  return <div ref={container} className="paypal-button-container" aria-label="Pay with PayPal" />;
}

export function money(value: number, currency: string | null | undefined): string {
  if (!currency) return `${new Intl.NumberFormat().format(value)} (currency not configured)`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function PageFrame({ onNavigate, children }: { onNavigate: Navigate; children: ReactNode }) {
  return (
    <div className="storefront shop-storefront">
      <StoreHeader onNavigate={onNavigate} />
      {children}
      <StoreFooter onNavigate={onNavigate} />
    </div>
  );
}

export function ShopLoading({ label }: { label: string }) {
  return (
    <div className="shop-state">
      <LoaderCircle className="spin" size={22} />
      {label}
    </div>
  );
}

export function ShopError({ message }: { message: string }) {
  return (
    <div className="shop-error-banner" role="alert">
      <CircleAlert size={17} />
      <span>{message}</span>
    </div>
  );
}

export function BackLink({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <a
      className="shop-back-link"
      href="/customers"
      onClick={(event) => {
        event.preventDefault();
        onNavigate("/customers");
      }}
    >
      <ArrowLeft size={14} /> Continue browsing
    </a>
  );
}
