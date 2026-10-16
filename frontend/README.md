# Sell Shells frontend

React and TypeScript inventory UI for the Express API in the parent project.

## Run locally

1. Apply the Supabase migrations and complete the root README's one-time superadmin bootstrap to use the staff manager.
2. For staff sign-in, copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Public browsing works without these Auth settings.
3. Start the API on `http://localhost:3000`.
4. In this directory, run `npm install` and then `npm run dev`.
5. Open the Vite URL printed in the terminal.

During local development, Vite proxies `/api` requests to `http://localhost:3000`. Set `VITE_API_BASE_URL` in a `.env` file to call another API origin. A deployed frontend must set this value to its API origin unless it is served behind a same-origin proxy. The API server needs to allow browser cross-origin requests if the frontend calls it directly.

Customers can browse the storefront without an account or sign-up flow. Staff sign in with Supabase Auth; staff sessions persist and are attached to API calls. Auth users receive the `user` role by default. A superadmin can assign roles in the protected `/admin/users` page. Only `admin` and `superadmin` can change inventory; role assignment itself is superadmin-only and cannot change the signed-in account's own role. The UI's route checks are for clarity; the API and database RLS enforce access independently.

The interface uses the API's paginated `{ data, pagination }` responses and its nullable request fields. Image upload follows the `image` multipart field and 5 MB limit. Shell list filtering uses the API's exact-match query parameters. The publishable key is expected in browser settings; never add `SUPABASE_SECRET_KEY` to this frontend project.

The public customer storefront is available at `/` and `/customers`; it does not render the admin sidebar and does not require a login. It uses anonymous-read API access for shell types from `/api/shell-types`, filters shells with the existing `shell_type_id` query parameter, and displays signed image URLs returned by `/api/shell-images`. Product cards open `/customers/shell/:shellId` in a new tab. That page reads shell details from `/api/shells/:id` and retrieves every associated image through paginated `/api/shell-images` requests filtered by `shell_id`.

The root route (`/`) is the customer storefront. Open the inventory manager at `/admin`. The Vercel rewrite in `vercel.json` serves the SPA entry point for these routes on direct visits and refreshes.
