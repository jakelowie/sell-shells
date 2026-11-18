# Shellhouse Admin Mobile

Standalone Expo Router application for the existing Shellhouse Express/Supabase backend. It uses the existing administrator authentication and API routes; no backend routes or database migrations were added for this app.

## Configuration

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_API_BASE_URL`: reachable backend URL. For a physical phone, use the development computer's LAN IP, not `localhost`.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the same public Supabase Auth configuration used by the existing web frontend. Do not put a Supabase secret/service-role key here.

The Supabase session is persisted with Expo SecureStore. The app checks `/api/auth/me` after authentication and only admits `admin` and `superadmin` roles. Backend authorization remains authoritative for every protected API request.

## Run

```sh
cd mobile
npm install
npx expo start
```

Use `npm run android` or `npm run ios` to launch on a configured emulator/simulator. For a physical device, install Expo Go (or build a development client for native configuration changes) and scan the Expo QR code. iOS simulator builds require macOS; Android emulator tooling is required for Android emulator runs.

## Current scope

- Administrator sign-in, secure persistent sessions, role verification, and sign-out.
- Overview of recent orders, fulfillment workload, returns, feedback, and captured sales from the latest 100 orders.
- Paginated order list, order detail, line items, and fulfillment updates through existing status-transition APIs.
- Shell listing search, create/edit, soft archive, and single image upload using the existing storage route.
- Read/review queues for returns, feedback, invoice requests, discount codes, shipping couriers, and public store settings.

Customer directory/history, complete product classification and multi-image editing, discount/courier/rate creation, editable settings, evidence preview, invoice file download/share, and filtering by date/status need additional mobile screens. The backend currently has no dedicated customer directory endpoint or dashboard aggregate endpoint. The dashboard explicitly labels its captured-sales calculation as limited to the latest 100 orders.
