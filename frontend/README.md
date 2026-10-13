# Sell Shells frontend

React and TypeScript inventory UI for the Express API in the parent project.

## Run locally

1. Start the API on `http://localhost:3000`.
2. In this directory, run `npm install` and then `npm run dev`.
3. Open the Vite URL printed in the terminal.

During local development, Vite proxies `/api` requests to `http://localhost:3000`. Set `VITE_API_BASE_URL` in a `.env` file to call another API origin. A deployed frontend must set this value to its API origin unless it is served behind a same-origin proxy. The API server needs to allow browser cross-origin requests if the frontend calls it directly.

The interface uses the API's paginated `{ data, pagination }` responses and its nullable request fields. Image upload follows the `image` multipart field and 5 MB limit. Shell list filtering uses the API's exact-match query parameters.

The customer storefront is available independently at `/customers`; it does not render the admin sidebar. It uses shell types from `/api/shell-types`, filters shells with the existing `shell_type_id` query parameter, and displays signed image URLs returned by `/api/shell-images`. Product cards open `/customers/shell/:shellId` in a new tab. That page reads shell details from `/api/shells/:id` and retrieves every associated image through paginated `/api/shell-images` requests filtered by `shell_id`.

The root route (`/`) is the customer storefront. Open the inventory manager at `/admin`. The Vercel rewrite in `vercel.json` serves the SPA entry point for these routes on direct visits and refreshes.
