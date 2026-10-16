import { ApiError } from "../errors/api-error";

type PayPalMode = "sandbox" | "live";
type PayPalSettings = {
  mode: PayPalMode;
  currency: string | null;
  deliveryFee: number;
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  checkoutEnabled: boolean;
};

type PayPalOrder = {
  id: string;
  status?: string;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: { captures?: Array<{ id?: string; status?: string; amount?: { currency_code?: string; value?: string } }> };
  }>;
};

let cachedAccessToken: { value: string; expiresAt: number } | undefined;

export function getPayPalSettings(): PayPalSettings {
  const modeValue = (process.env.PAYPAL_MODE?.trim().toLowerCase() || "sandbox");
  const mode: PayPalMode = modeValue === "live" ? "live" : "sandbox";
  if (modeValue !== "live" && modeValue !== "sandbox") throw new ApiError(503, "PAYPAL_MODE must be sandbox or live.");

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() || "";
  const currency = process.env.PAYPAL_CURRENCY?.trim().toUpperCase() || null;
  const rawFee = process.env.PAYPAL_DELIVERY_FEE?.trim() || "0";
  const deliveryFee = Number(rawFee);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) throw new ApiError(503, "PAYPAL_DELIVERY_FEE must be a non-negative number.");
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new ApiError(503, "PAYPAL_CURRENCY must be a three-letter ISO currency code.");
  if (currency) {
    try { new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0); }
    catch { throw new ApiError(503, "PAYPAL_CURRENCY is not a supported ISO currency code."); }
  }

  return {
    mode,
    currency,
    deliveryFee,
    clientId,
    clientSecret,
    webhookId: process.env.PAYPAL_WEBHOOK_ID?.trim() || null,
    checkoutEnabled: Boolean(clientId && clientSecret && currency)
  };
}

export function getPublicShopConfig() {
  const settings = getPayPalSettings();
  return {
    checkout_enabled: settings.checkoutEnabled,
    currency: settings.currency,
    delivery_fee: settings.deliveryFee,
    paypal_client_id: settings.clientId || null,
    paypal_mode: settings.mode
  };
}

export function formatPayPalAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "Order amount is invalid.");
  let digits: number;
  try {
    digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    throw new ApiError(503, "PAYPAL_CURRENCY is not a supported ISO currency code.");
  }
  const factor = 10 ** digits;
  if (Math.abs(amount * factor - Math.round(amount * factor)) > 1e-7) {
    throw new ApiError(400, `Order total has more decimal places than ${currency} supports. Adjust product prices or the delivery fee.`);
  }
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(amount);
}

function apiBaseUrl(): string {
  return getPayPalSettings().mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken(): Promise<string> {
  const settings = getPayPalSettings();
  if (!settings.clientId || !settings.clientSecret) throw new ApiError(503, "PayPal checkout is not configured on the server.");
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) return cachedAccessToken.value;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
  } catch {
    throw new ApiError(502, "Could not connect to PayPal. Try again shortly.");
  }
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok || typeof result !== "object" || result === null || !("access_token" in result) || typeof result.access_token !== "string") {
    throw new ApiError(502, "PayPal authentication failed. Check the server-side PayPal credentials and mode.");
  }
  const expiresIn = "expires_in" in result && typeof result.expires_in === "number" ? result.expires_in : 300;
  cachedAccessToken = { value: result.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return cachedAccessToken.value;
}

async function paypalRequest<T>(path: string, method: "GET" | "POST", body?: unknown, requestId?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new ApiError(502, "Could not connect to PayPal. Try again shortly.");
  }
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not forward provider payloads because they can contain transaction/customer data.
    const status = response.status === 422 || response.status === 409 ? 409 : 502;
    throw new ApiError(status, status === 409
      ? "PayPal could not complete this payment. Review the order and try again."
      : "PayPal is temporarily unavailable. Try again shortly.");
  }
  return result as T;
}

export async function createPayPalOrder(input: {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  requestId: string;
}): Promise<{ id: string; status: string | null }> {
  const result = await paypalRequest<Partial<PayPalOrder>>("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: input.orderId,
      invoice_id: input.orderNumber,
      amount: { currency_code: input.currency, value: formatPayPalAmount(input.total, input.currency) }
    }],
    application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" }
  }, input.requestId);
  if (!result.id || typeof result.id !== "string") throw new ApiError(502, "PayPal did not return a valid order reference.");
  return { id: result.id, status: typeof result.status === "string" ? result.status : null };
}

export type VerifiedCapture = { orderId: string; captureId: string; amount: string; currency: string };

export async function capturePayPalOrder(input: {
  paypalOrderId: string;
  localOrderId: string;
  requestId: string;
  expectedAmount: number;
  currency: string;
}): Promise<VerifiedCapture> {
  const result = await paypalRequest<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(input.paypalOrderId)}/capture`,
    "POST",
    {},
    input.requestId
  );
  return validatePayPalOrder(result, {
    paypalOrderId: input.paypalOrderId,
    localOrderId: input.localOrderId,
    expectedAmount: input.expectedAmount,
    currency: input.currency,
    requireCompleted: true
  });
}

export async function verifyPayPalWebhook(headers: Record<string, string | undefined>, event: unknown): Promise<boolean> {
  const settings = getPayPalSettings();
  if (!settings.webhookId) throw new ApiError(503, "PayPal webhook verification is not configured on the server.");
  const required = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"]
  };
  if (Object.values(required).some(value => !value)) return false;
  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", "POST", {
    ...required,
    webhook_id: settings.webhookId,
    webhook_event: event
  });
  return result.verification_status === "SUCCESS";
}

export async function getPayPalOrder(paypalOrderId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, "GET");
}

export function validatePayPalOrder(
  result: PayPalOrder,
  expected: { paypalOrderId: string; localOrderId: string; expectedAmount: number; currency: string; requireCompleted: boolean }
): VerifiedCapture {
  if (result.id !== expected.paypalOrderId || (expected.requireCompleted && result.status !== "COMPLETED")) {
    throw new ApiError(409, "PayPal payment has not completed for this order.");
  }
  const purchaseUnit = result.purchase_units?.find(unit => unit.reference_id === expected.localOrderId);
  const capture = purchaseUnit?.payments?.captures?.find(item => item.status === "COMPLETED");
  const currency = capture?.amount?.currency_code;
  const amount = capture?.amount?.value;
  const parsedAmount = amount === undefined ? Number.NaN : Number(amount);
  if (!capture?.id || currency !== expected.currency || !Number.isFinite(parsedAmount) ||
      formatPayPalAmount(parsedAmount, expected.currency) !== formatPayPalAmount(expected.expectedAmount, expected.currency)) {
    throw new ApiError(409, "The captured PayPal payment does not match the order total and currency.");
  }
  return { orderId: result.id, captureId: capture.id, amount: amount!, currency };
}
