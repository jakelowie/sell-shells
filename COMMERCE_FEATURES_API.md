# Customer and commerce management API

The API is mounted by the existing Express app. Customer-specific requests use the existing guest capability header, `X-Shop-Token`; administrators use the existing Supabase bearer token and must have `admin` or `superadmin` role. All bodies are validated server-side. The server-only Supabase key is never returned to the browser.

## Customer routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/customer/contact` | Guest; optional guest token for order association | Submit an inquiry (`customer_name`, `email`, optional `order_id`, `subject`, `message`). |
| `GET` | `/api/customer/settings` | Public | Read configured public business contact, payment information, and return policy. |
| `POST` | `/api/customer/feedback` | Guest | Submit one feedback message for an owned order (`order_id`, `feedback_message`). |
| `GET` | `/api/customer/feedback?limit=20&offset=0` | Guest | Paginated feedback for the current guest session. |
| `POST` | `/api/customer/discounts/validate` | Guest | Preview a discount (`code`, `subtotal`). Checkout independently checks and applies it against database prices in a transaction. |
| `POST` | `/api/customer/returns` | Guest | Submit a return (`order_id`, `reason`, `details`, optional `requested_resolution`). Requires a configured return policy and paid, owned order. |
| `GET` | `/api/customer/returns?limit=20&offset=0` | Guest | Paginated return requests owned by the guest session. |
| `POST` | `/api/customer/returns/{returnId}/evidence` | Guest | Upload one JPEG, PNG, WebP, or GIF image in multipart field `image`, up to 5 MB. |
| `GET` | `/api/customer/returns/{returnId}/evidence` | Guest | Return short-lived signed links for evidence owned by the session. |
| `POST` | `/api/customer/invoices` | Guest | Request an invoice (`order_id`) for an owned order. |
| `GET` | `/api/customer/invoices` | Guest | List invoice requests and generated historical snapshots. |
| `POST` | `/api/shop/orders` | Guest | Create a checkout. The optional `discount_code` is the only pricing input. The server calculates shipping from each shell's assigned `shipping_id` (`shipping_fee × quantity`) and saves item-level shipping snapshots before PayPal creation. Do not send a client total, fee, or destination-rate selection. |

All paginated responses contain `{ data, pagination: { limit, offset, total } }`. Invalid ownership is returned as not found so order identifiers cannot be used to enumerate other sessions' data.

The legacy public `GET /api/customer/shipping?country=PH` destination-rate endpoint remains available for existing integrations. The current customer bag and checkout do not use it; checkout uses each shell's assigned shipping fee.

## Administrator routes

All paths below are under `/api/admin/commerce` and require admin or superadmin authentication.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/feedback` | Paginated feedback records. |
| `GET` | `/inquiries` | Paginated contact inquiries. |
| `GET`, `PATCH` | `/returns` and `/returns/{id}` | List and transition return requests. Transitions and audit history are recorded in one database transaction. |
| `GET` | `/returns/{id}/history` | Return request audit history. |
| `GET` | `/returns/{id}/evidence` | Short-lived signed evidence links. |
| `GET`, `PATCH` | `/invoices` and `/invoices/{id}` | List and review invoice requests. |
| `POST` | `/invoices/{id}/generate` | Create an invoice snapshot from historical order items, discount, shipping, customer, and payment data. Invoice numbers use a database identity/unique constraint. |
| `GET` | `/orders/{id}/history` | Fulfillment status audit history. |
| `PATCH` | `/orders/{id}/status` | Update fulfillment status with optional remarks and shipping details; the database validates the transition and records history atomically. |
| `GET`, `POST`, `PATCH`, `DELETE` | `/discounts` and `/discounts/{id}` | Manage discount codes. Delete archives by deactivating, preserving usage history. |
| `GET`, `POST`, `PATCH` | `/shipping/couriers`, `/shipping/services`, `/shipping/rates` | Legacy admin configuration endpoints. These destination-based rates are no longer used by guest checkout, which uses each shell's assigned `shipping_fee` record. |
| `GET`, `PATCH` | `/settings` | Manage public store contact and payment information and the return policy. No private payment credentials are accepted. |

For full route schemas, the TypeScript Zod validators/controllers are the source of truth. The SQL migration `supabase/migrations/20261114010000_commerce_features.sql` depends on the existing shop schema described in [ECOMMERCE_IMPLEMENTATION.md](ECOMMERCE_IMPLEMENTATION.md). This checkout does not contain the earlier base shop migrations, so apply that migration only to a database where those documented tables and functions already exist. Apply [20261119000000_shell_assigned_shipping_checkout.sql](migrations/20261119000000_shell_assigned_shipping_checkout.sql) afterward to switch guest checkout to shell-assigned fees and preserve per-item shipping snapshots.
