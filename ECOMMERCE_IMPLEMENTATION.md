# Customer E-commerce Implementation

## 1. Overview

The storefront now supports public shell browsing, a persistent guest cart, delivery details, PayPal checkout, session-scoped order history, invoice viewing and printing. Customers do not create Supabase Auth accounts. Existing Supabase Auth remains the staff sign-in system.

The backend is the authority for product price, quantity, availability, order totals and payment state. Guest requests use a random 32-byte capability token. Only its SHA-256 hash is stored in Supabase. Cart and order rows are private and all commerce writes use the server-only `SUPABASE_SECRET_KEY` client. Database functions serialize cart edits and checkout stock checks by locking guest sessions and shell rows.

The existing inventory table remains the stock source. Available stock is the sum of `shell_stock * shell_pcs_per_stock` for a shell (falling back to `shell_total_available` when either source value is null), minus quantities in paid orders and unexpired pending orders. A checkout reservation lasts 30 minutes. No quantity is invented when the inventory rows are missing; availability is zero.

Currency, delivery fees, tax, shipping rules and store business details are not present in the supplied schema. The implementation requires a configured PayPal currency before checkout. The delivery fee is configurable and defaults to zero; no tax is calculated. Addresses are snapshots on orders; there is no customer profile or address book.

## 2. Frontend Changes

- `frontend/src/features/storefront/CustomerApp.tsx` routes customer paths to the storefront, cart, checkout, order list and order invoice. It displays live availability, configured currency and an add-to-bag action on shell details.
- `frontend/src/features/storefront/StoreChrome.tsx` shares collection navigation and displays the guest bag count. Anonymous shoppers do not see staff-management navigation; signed-in staff continue to see their existing controls.
- `frontend/src/features/storefront/ShopPages.tsx` implements cart management, customer and delivery forms, PayPal JS SDK buttons, order history, payment-pending states and printer-friendly invoices.
- `frontend/src/shared/api/shop.ts` creates and stores the guest capability token in browser local storage, sends it in `X-Shop-Token`, and wraps the commerce API.
- `frontend/src/shared/api/types.ts` defines the commerce request and response types; `frontend/src/shared/api/index.ts` exports the client methods.
- `frontend/src/shared/styles.css` adds responsive commerce styles and a print layout that prints the invoice without navigation or actions.

The bag and order history are tied to the current browser's capability token. There is no merge-to-customer-account flow because customer accounts are intentionally not part of this project. Clearing browser storage loses access to that guest session's saved cart and order history.

## 3. Backend Changes

- `src/routes/shop.ts` exposes public configuration, session creation, availability and webhook routes, then protects customer-specific routes with the guest-session middleware.
- `src/controllers/shop.controller.ts` validates route/query/body data and emits the API response envelopes.
- `src/middleware/shop-session.ts` validates `X-Shop-Token`, hashes it and resolves only the matching session.
- `src/services/shop.service.ts` performs session-scoped cart/order access, calls transactional database functions, creates PayPal orders and reconciles verified payments.
- `src/services/paypal.service.ts` implements PayPal OAuth, order creation/capture, currency precision checks and webhook-signature verification using the built-in `fetch` API; no additional package was added.
- `src/validation/shop.ts` validates UUIDs, quantities, contact details and delivery addresses.
- `src/models/database.ts` adds typed commerce tables and RPC functions. `src/config/supabase.ts` adds a cached, server-only commerce client. `src/types/express.d.ts` adds the resolved guest session ID.
- `src/app.ts` mounts `/api/shop`; `src/controllers/shared.ts` maps commerce database errors to safe HTTP responses.
- `swagger.json` documents the new routes and `sell-shells.insomnia.json` includes importable sample requests.

## 4. Database Changes

Migration: `supabase/migrations/20261017010000_customer_shop.sql`.

The migration adds:

- `shop_sessions`: guest session ID and unique SHA-256 token hash. Raw capability tokens never enter the database.
- `shop_carts`: session-owned active or converted carts; a partial unique index permits one active cart per session.
- `shop_cart_items`: shell FK, quantity check (1–100), and cart/shell primary key.
- `shop_orders`: unique human-readable order number, session/cart references, checkout idempotency key, status fields, customer contact snapshot, delivery-address JSON snapshot, currency, subtotal, delivery fee, total, PayPal references, payment metadata, expiry and timestamps.
- `shop_order_items`: order FK and historical shell name, quantity, unit price and line total snapshots; shell deletion does not erase invoice data.
- `shop_order_number_seq` and indexes for active carts, order history, reservations and order items.
- `shop_available_quantities`, `shop_cart_snapshot`, `shop_add_cart_item`, `shop_set_cart_item` and `shop_create_order` RPC functions. The checkout function locks shell rows in stable order, rechecks live prices and stock, snapshots line items and converts the cart in one transaction.

RLS is enabled on all commerce tables. `anon` and `authenticated` have no table privileges and no RLS policies; the trusted backend uses the server-only Supabase secret role. RPC execution is revoked from browser roles and granted only to `service_role`. Existing catalog tables and role/RLS migrations are not changed by this migration.

## 5. API Reference

The API base is `http://localhost:3000` by default. Customer endpoints do not require Supabase Auth. The customer-specific routes require `X-Shop-Token: <token>` from `POST /api/shop/sessions`. Do not share this capability token.

### Public endpoints

#### `GET /api/shop/config`

Returns public checkout readiness, currency, delivery fee, PayPal client ID and mode. It never returns the PayPal secret.

Example response:

```json
{
  "data": {
    "checkout_enabled": true,
    "currency": "<configured ISO currency>",
    "delivery_fee": 0,
    "paypal_client_id": "<public sandbox client ID>",
    "paypal_mode": "sandbox"
  }
}
```

#### `POST /api/shop/sessions`

Creates a guest session. Save the returned token in the browser and send it with protected routes.

```json
{
  "data": {
    "session_id": "<uuid>",
    "token": "<one-time returned bearer capability>"
  }
}
```

#### `GET /api/shop/availability?ids=<uuid>,<uuid>`

Returns current available quantity per shell ID. Accepts up to 100 shell UUIDs; no customer token is required.

### Guest-session endpoints

#### `GET /api/shop/cart`

Response: `{ "data": { "cart_id": "<uuid-or-null>", "items": [] } }`. Each item contains `shell_id`, `quantity`, `shell_name`, current `price`, `is_deleted` and `available`.

#### `POST /api/shop/cart/items`

Adds the requested quantity to the existing cart quantity. Quantity is an integer from 1 to 100.

```json
{ "shell_id": "<shell UUID>", "quantity": 1 }
```

#### `PUT /api/shop/cart/items/{shellId}`

Sets the exact quantity for a cart item.

```json
{ "quantity": 2 }
```

#### `DELETE /api/shop/cart/items/{shellId}`

Removes the item and returns the updated cart.

#### `POST /api/shop/orders`

Creates a local pending order, validates current prices and stock, reserves stock for 30 minutes and creates a PayPal order. `idempotency_key` must be a UUID; reuse the same key when retrying a timed-out request. The server uses the configured currency/delivery fee and ignores client-submitted prices.

```json
{
  "idempotency_key": "<new UUID for this checkout attempt>",
  "customer": {
    "name": "Taylor Shell",
    "email": "taylor@example.com",
    "phone": "+1 555 555 0100"
  },
  "delivery_address": {
    "street_address": "12 Shore Road",
    "city": "Cebu City",
    "province": "Cebu",
    "postal_code": "6000",
    "country": "Philippines",
    "address_details": "Leave at reception"
  }
}
```

Response: `201 { "data": { ...order fields, "paypal_order_id": "<PayPal order ID>", "items": [...] } }`. The customer must approve this order in PayPal before capture.

#### `POST /api/shop/orders/{orderId}/capture`

Capture the approved PayPal order. The backend checks PayPal's completed status, local order association, amount and currency before setting `order_status=paid` and `payment_status=captured`. Repeated calls return the persisted order when already captured.

#### `GET /api/shop/orders`

Lists only this guest session's orders, newest first. Supports `limit` (1–100) and `offset`.

#### `GET /api/shop/orders/{orderId}`

Returns the session-owned order and persisted invoice data. Pending, failed or refunded orders remain clearly identified and are not presented as paid.

### PayPal webhook

#### `POST /api/shop/paypal/webhook`

Configure PayPal to call this route for `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED` and `PAYMENT.CAPTURE.REFUNDED`. The backend asks PayPal to verify the signature before reconciling an event. Completed captures are re-read and amount/currency checked against the local order. Duplicate events are safe. Refunds update payment state; the system does not automatically alter physical inventory on a refund.

Validation errors return `400`; missing/invalid guest tokens return `401`; another session's order returns `404`; stock conflicts return `409`; missing database/PayPal configuration returns `503`; provider outages return `502`. Responses avoid raw provider payloads and secret values.

## 6. PayPal Integration

The browser uses PayPal's JavaScript SDK with only the public client ID. The server obtains OAuth access tokens using the backend-only client secret, creates CAPTURE orders with a PayPal request ID derived from the checkout idempotency UUID, and captures using a stable per-order request ID. The local order is marked paid only after verification. Access tokens are cached in backend memory until shortly before expiry.

### Sandbox setup

1. Create a PayPal sandbox REST app and use its sandbox client ID and secret.
2. Set `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and the business's actual `PAYPAL_CURRENCY` in the server `.env`.
3. Set `PAYPAL_DELIVERY_FEE` to the store's actual fixed delivery fee, or leave it at `0` if there is no fee.
4. Apply the commerce migration before starting the server.
5. Create a sandbox buyer, open the storefront, add a priced/in-stock shell, enter a delivery address and approve the PayPal button.
6. Verify the saved order's captured state and invoice. Insomnia can inspect or trigger API requests but cannot itself complete the browser PayPal approval experience.

For asynchronous reconciliation, create a PayPal webhook with the three events listed above and set the webhook ID in `PAYPAL_WEBHOOK_ID`. The webhook URL must be publicly reachable over HTTPS in production.

For production, change `PAYPAL_MODE=live`, use live app credentials and a live currency, configure the production webhook ID, restrict access to deployment secrets, and use HTTPS. Never put `PAYPAL_CLIENT_SECRET` or `SUPABASE_SECRET_KEY` in a `VITE_` variable or frontend build.

## 7. Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `SUPABASE_URL` | Backend only | Existing Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Backend configuration | Existing non-privileged key used by catalog/auth clients. |
| `SUPABASE_SECRET_KEY` | Backend only | Required for trusted commerce reads/writes and Storage. Never expose it in browser code. |
| `PAYPAL_MODE` | Backend; public mode is returned to storefront | `sandbox` or `live`; defaults to `sandbox`. |
| `PAYPAL_CLIENT_ID` | Backend value; public ID is sent to browser SDK | PayPal application client ID. |
| `PAYPAL_CLIENT_SECRET` | Backend only | PayPal OAuth secret. |
| `PAYPAL_CURRENCY` | Backend; public currency is returned | Three-letter supported ISO currency code. Empty/unset disables checkout. No currency is assumed. |
| `PAYPAL_DELIVERY_FEE` | Backend; amount is shown in checkout | Non-negative numeric charge in configured currency; defaults to `0`. |
| `PAYPAL_WEBHOOK_ID` | Backend only | PayPal webhook ID used to verify transmissions. Optional for button-based flow; required for signature verification. |
| `PORT` | Backend | Express listening port; defaults to `3000`. |
| `VITE_API_BASE_URL` | Frontend build | Optional API origin; Vite proxies `/api` to `localhost:3000` in development. |

Placeholders for new server variables are in `.env.example`. Do not commit `.env` or real PayPal credentials.

## 8. Customer Workflow

1. A customer browses the public shell collection and detail images without signing in.
2. The storefront creates a guest session on first bag access; the browser retains its returned capability token.
3. Add, quantity update and remove requests are scoped to that guest session. Prices and available quantities shown in the bag are read from the database.
4. The customer submits name, email, phone and delivery address. The address is copied onto the order at checkout.
5. The backend locks the active cart and shell rows, rechecks current price and stock, snapshots order items/totals and reserves stock for 30 minutes.
6. The browser opens the PayPal button using the server-created PayPal order.
7. After buyer approval, the backend captures and verifies the order/amount/currency association; only then it records a paid order.
8. The customer can revisit orders for the same browser session, view the saved invoice and print it. Pending/failed orders show their unpaid status.

## 9. Security Considerations

- Guest capability token: generated with 256 bits of randomness, returned once, stored client-side as a bearer token, hashed with SHA-256 in Supabase, and compared only server-side. Anyone with the token can access that guest session's cart/orders, so it must be kept private.
- Ownership: every cart/order query filters by the session ID resolved from the token. Order IDs alone do not grant access.
- Database: browser roles have no commerce-table grants or RPC execution; RLS is enabled. Only backend code uses the Supabase secret key.
- Prices and inventory: the backend never accepts prices or totals from the browser. Checkout recalculates from `shell_description.price` and stock rows while locking the shell record. Cart update and checkout enforce quantity bounds and stock.
- Payment: local orders remain pending until server-side capture verification. PayPal callback data from the browser is not treated as proof. Request IDs and local idempotency keys protect retries. Webhook events are signature-verified.
- Input: Zod validates IDs, quantities, email/phone and address limits. PostgREST filters use fixed column names and parameterized Supabase APIs.
- There is no customer login, saved profile or customer role. Existing staff auth and role authorization remain separate.

## 10. Testing and Verification

Added `tests/shop.test.cjs` coverage for checkout/contact/address validation, quantity and UUID limits, supported currency precision and rejection of silent rounding. Extended `tests/shells.test.cjs` to cover public checkout configuration, absence of secret fields, guest-cart authentication and availability query validation.

Checks run during implementation:

- `npm run build` — passed.
- `npm run build:frontend` — passed after resolving TypeScript errors.
- `npm test` — build passed; the test HTTP server could not be reached in the restricted local environment (`fetch failed` for the existing localhost-based API integration suite). The loopback-dependent test run remains to be repeated in an environment that permits local socket binding.
- Migration application and PayPal sandbox capture/webhook were not run because database access and PayPal credentials are not configured as part of this task.

No lint command is configured in the project.

## 11. Files Changed

### Created

- `ECOMMERCE_IMPLEMENTATION.md` — this implementation and setup record.
- `supabase/migrations/20261017010000_customer_shop.sql` — guest commerce tables, RLS/grants, stock and checkout RPCs.
- `src/controllers/shop.controller.ts` — commerce HTTP handlers.
- `src/middleware/shop-session.ts` — guest capability-token validation and session resolution.
- `src/routes/shop.ts` — commerce route definitions.
- `src/services/paypal.service.ts` — PayPal API, amount validation and webhook verification.
- `src/services/shop.service.ts` — cart, order, ownership and payment orchestration.
- `src/validation/shop.ts` — commerce validation schemas.
- `frontend/src/features/storefront/ShopPages.tsx` — cart, checkout, orders, PayPal buttons and invoice UI.
- `frontend/src/features/storefront/StoreChrome.tsx` — shared storefront header/footer with bag count.
- `frontend/src/shared/api/shop.ts` — guest session and commerce API client.
- `tests/shop.test.cjs` — checkout validation and PayPal money-format tests.

### Modified

- `.env.example` — PayPal configuration placeholders.
- `.gitignore` — allowlist the commerce migration under the previously ignored `supabase` directory.
- `frontend/src/features/storefront/CustomerApp.tsx` — customer path routing, stock availability, configured price display and add-to-bag.
- `frontend/src/shared/api/index.ts` — exports commerce API and types.
- `frontend/src/shared/api/types.ts` — storefront commerce types.
- `frontend/src/shared/styles.css` — storefront commerce, responsive and print styles.
- `src/app.ts` — mount `/api/shop`.
- `src/config/supabase.ts` — server-only commerce Supabase client.
- `src/controllers/shared.ts` — safe commerce database error mapping.
- `src/models/database.ts` — typed commerce tables and RPC definitions.
- `src/types/express.d.ts` — guest session request property.
- `swagger.json` — OpenAPI JSON documentation for the commerce API.
- `sell-shells.insomnia.json` — importable commerce requests and environment values.
- `tests/shells.test.cjs` — commerce configuration and guest access checks.

No existing files were deleted or moved. Build output is generated under ignored `dist` directories.

## 12. Setup and Deployment

1. Apply `supabase/migrations/20261017010000_customer_shop.sql` to the same Supabase project as the existing shell schema. Use Supabase CLI after linking the project (`supabase db push`) or run the SQL file in the Supabase SQL editor. Review the SQL and ensure the project has the `anon`, `authenticated` and `service_role` roles before applying.
2. Copy `.env.example` to `.env`. Fill existing Supabase URL/publishable/secret values and PayPal sandbox credentials. Choose the actual business currency and delivery fee; checkout remains disabled without `PAYPAL_CURRENCY` and valid PayPal credentials.
3. Start the API with `npm run dev` and the frontend with `npm --prefix frontend run dev` in separate terminals. The Vite dev server proxies `/api` to port 3000.
4. Use the storefront at the Vite URL. Customers can browse without an account. Configure PayPal sandbox buyer credentials to finish a payment.
5. Import `sell-shells.insomnia.json` if you want to inspect the APIs. First call `Shop - create guest session`, then copy `data.token` into `shop_session_token` in the Base Environment. PayPal approval must happen in the storefront before using the Insomnia capture request.
6. Configure and verify PayPal webhooks if enabled. Production requires HTTPS, live PayPal credentials, secret management and a public webhook URL.

## 13. Known Limitations and Follow-up Work

- Currency and delivery pricing are store configuration, not existing schema fields. The project owner must set the real currency and fee; tax and carrier-based shipping calculations are not implemented.
- There is no customer email service, customer account, cross-device order recovery, saved address book, fulfillment state, refund initiation or automatic physical stock restock. Order confirmations and invoices are available in the current guest browser session.
- A guest token is held in local storage so refreshes preserve the cart; browser storage loss makes that guest session unrecoverable. A future deployment may choose an HttpOnly-cookie session design and a retention/cleanup policy for guest session rows.
- Pending checkout reservations expire after 30 minutes. A customer who abandons PayPal may start again by adding products to a new cart; the old order remains in history as pending until its expiry window passes.
- Refund webhooks mark an order refunded, but physical returned stock must be reconciled through the existing inventory workflow. No fulfillment/shipping workflow was specified.
- PayPal sandbox credentials, live database migration execution and webhook delivery still need environment-specific verification.
