# PayPal Sandbox Checkout Fix

## Root cause

The frontend passed the correct PayPal order ID (`data.paypal_order_id`) to the SDK, and the existing backend already creates CAPTURE orders and only marks an order paid after verifying a completed capture.

The concrete frontend defect was PayPal button teardown during checkout. `createPaypalOrder` changes identity after the local order is saved because it depends on `createdOrder`. `PayPalButton` included that callback in its effect dependencies, and the effect cleanup calls `buttons.close()`. Saving the order therefore closed the active PayPal Buttons instance while the SDK was opening the approval experience. This is a code-confirmed lifecycle fault and a plausible direct cause of the popup stalling while PayPal retrieves checkout details.

The project does not include a browser Network/Console recording or a reproduced PayPal popup session, so the pending `GetCheckoutDetails` request cannot be independently attributed to that teardown from a trace. The iframe warning and logger request were not treated as causes. A full buyer approval and capture was not verified.

## Evidence

- `ShopPages.tsx` returned `order.paypal_order_id`, not the local database ID.
- The PayPal button effect depended on callback identities (`createOrder`, `onCancel`, `onError`) and its cleanup closed the instance.
- Creating the order updates React state, changing `createPaypalOrder` identity during the SDK flow.
- Backend configuration exposes only the public client ID and mode; secrets stay server-side.
- Backend capture validation requires the expected PayPal order ID, a `COMPLETED` order and capture, the local order reference, and matching amount/currency before setting the local order to captured.
- Sandbox buyer credentials were not available in the project configuration, so live browser checkout could not be completed here.

## Files changed

- `frontend/src/features/storefront/ShopPages.tsx`
- `src/services/shop.service.ts`
- `tests/shop.test.cjs`
- `PAYPAL_SANDBOX_CHECKOUT_FIX.md` (this report)

## Changes

- Kept the PayPal Buttons instance stable across checkout state updates by reading the latest handlers from a ref. The effect now reinitializes only when its SDK configuration changes; cleanup still closes the instance when the component is actually removed or its configuration changes.
- Added frontend diagnostics for button initialization, SDK initialization errors, PayPal order ID return, buyer approval, cancellation, order-creation failure, capture failure, and SDK callback failure. Logs identify local orders where available and do not include customer details or credentials.
- Added structured backend logs for local order creation, PayPal order creation/linking, capture requests, capture failures, and verified local capture updates. Logs use local order IDs and provider references without logging tokens, credentials, addresses, or customer contact details.
- Added a unit test proving that only a completed capture for the expected PayPal order, local reference, currency, and total validates.

## Flow after the fix

1. The browser loads the PayPal SDK with the public client ID, configured currency, and `intent=capture`.
2. PayPal's `createOrder` callback calls the existing shop endpoint. The backend validates the cart and creates/reuses a local pending order and its PayPal order.
3. The browser resolves the SDK callback with the returned PayPal order ID. The local order state update no longer tears down the active Buttons instance.
4. PayPal presents its approval experience. `onApprove` sends the local order ID to the backend capture endpoint; the SDK's approval response is checked against the stored PayPal order ID.
5. The backend captures and verifies the payment and amount/currency before updating the local order to paid/captured. Cancellations and failed captures leave it unpaid.

## Configuration

No configuration changes were made. The server needs `PAYPAL_MODE=sandbox`, the matching Sandbox app's `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, a supported `PAYPAL_CURRENCY`, and optionally `PAYPAL_DELIVERY_FEE` and `PAYPAL_WEBHOOK_ID`. The client secret remains server-only. The browser needs access to the configured Sandbox buyer account for a complete manual checkout.

## Testing and results

- `npm run build` (backend): passed.
- `node --test tests/shop.test.cjs`: passed, 6 tests including completed-capture verification and mismatch rejection.
- `npm run build` (frontend): passed.
- `git diff --check`: passed.
- `npm test`: backend compilation passed, but 11 existing HTTP integration cases failed with `fetch failed` when their test helper tried to call the local test server; 5 other tests passed. This environment-level local HTTP failure prevented full suite verification.
- Real Sandbox checkout: not performed. No buyer credentials or browser trace were available; successful buyer approval and capture remain unverified.

## Reproduce and verify

1. Start the backend and frontend with the Sandbox values above and confirm `/api/shop/config` reports checkout enabled and Sandbox mode.
2. Open checkout, enter delivery details, and click the PayPal button. In DevTools, confirm the create-order response's `data.paypal_order_id` is the value returned to PayPal's `createOrder` callback.
3. Confirm the browser console reports PayPal initialization and order readiness, and the PayPal Buttons component remains mounted after local order creation.
4. Sign in with a Sandbox buyer and approve. Confirm the browser receives `onApprove`, the backend logs capture requested and verified, and the local order becomes `payment_status=captured` with a capture ID.
5. Repeat with cancellation and a deliberately rejected/failed capture in a test Sandbox account; verify the local order remains pending/failed and is never marked paid without a verified completed capture.

## Remaining verification

The code lifecycle issue is fixed, but a real browser trace is still needed to confirm that the specific PayPal GraphQL stall disappears. Complete one Sandbox buyer approval/capture and rerun the full HTTP integration suite in an environment where the Node test process can reach its local test servers.
