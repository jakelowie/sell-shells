# Deploy sell-shells to Vercel

This repository contains two deployable applications: an Express API at the repository root and a Vite React frontend in `frontend/`. Deploy them as two Vercel projects connected to the same Git repository. Vercel supports multiple projects from a monorepo by setting a different Root Directory for each project ([Vercel monorepo guide](https://vercel.com/docs/monorepos)).

## Before you start

You need:

- A GitHub, GitLab, or Bitbucket repository containing this project, pushed with the latest changes.
- A Vercel account connected to that Git provider.
- A Supabase project with the inventory schema, image storage setup, and role/RLS migration applied. Follow the root [README](README.md) for the required migrations and first-superadmin bootstrap.

Do not commit `.env` files or paste Supabase secrets into frontend settings. Add secret values only to the backend Vercel project.

## 1. Deploy the API

1. In Vercel, select **Add New → Project** and import the repository.
2. Set the project name to something like `sell-shells-api`.
3. Set **Root Directory** to the repository root (`.`). Keep the Express framework/build settings on automatic detection. The API exports its Express app from `src/app.ts`, a Vercel-recognized Express entry point ([Express on Vercel](https://vercel.com/docs/frameworks/backend/express)).
4. In **Settings → Environment Variables**, add these values for **Production** and **Preview** as appropriate:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key |
   | `SUPABASE_SECRET_KEY` | The server-only secret key used for Storage operations |
   | `SUPABASE_SIGNED_URL_TTL_SECONDS` | Optional; for example `3600` |

   Do not set `PORT`; Vercel supplies its own runtime. The secret key must stay in this backend project and must never be added to the frontend.

5. Deploy. Copy the resulting API deployment URL, for example `https://sell-shells-api.vercel.app`.
6. Check these URLs in a browser or with `curl`:

   - `https://<api-domain>/health` should return `{"status":"ok"}`.
   - `https://<api-domain>/api-docs.json` should return the OpenAPI document.
   - `https://<api-domain>/api/shell-types?limit=1&offset=0` should return a paginated response without a Supabase session.

If a route returns a server error, inspect the API project's **Deployments → Functions → Logs** and verify the Supabase environment variables and database policies. Environment variable changes apply to new deployments, so redeploy after changing them ([Vercel environment variables](https://vercel.com/docs/environment-variables)).

## 2. Deploy the frontend

1. In Vercel, import the same Git repository again as a second project.
2. Set the project name to something like `sell-shells-frontend`.
3. Set **Root Directory** to `frontend`.
4. Select **Vite** if Vercel does not detect it automatically. Use:

   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

   These are the frontend's existing build script and Vite output directory ([Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)).

5. Add these environment variables to **Production** and **Preview** for the staff admin login:

   | Name | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | The API deployment URL from step 1, with no trailing slash |
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |

   Example API URL: `https://sell-shells-api.vercel.app`. Vite embeds `VITE_*` values into the browser bundle, so these must contain only public configuration and the publishable key, never a secret.

6. Deploy. Open the frontend deployment and check `/` for the storefront and `/admin` for the inventory manager. The included `frontend/vercel.json` rewrite serves the SPA entry point for direct visits and refreshes on these routes.

## 3. Verify the deployed connection

Open the frontend without signing in and confirm shell types, shells, and signed image URLs load. Customer browsing is public. To enable the staff manager, provision staff accounts through Supabase Auth (Dashboard or invite), allow the frontend origin in Supabase Auth redirect URLs as needed, and bootstrap the first superadmin using the SQL instructions in the README. `/admin` and inventory mutations require `admin` or `superadmin`. If the browser reports a CORS error, confirm the backend deployment includes the CORS middleware and redeploy it. CORS currently allows all origins and preflight requests.

The API applies a limit of 10 requests per second per client IP. Its counters are stored in process memory, so Vercel instances enforce their limits independently rather than sharing one global counter.

## Access control and upload behavior

- **Role enforcement is server-side and database-side.** Public catalog GET requests are allowed for the Supabase `anon` role by explicit RLS policies. Inventory writes require the API to verify Supabase access tokens and resolve roles from `public.user_roles`; RLS independently enforces write permissions. The frontend uses the publishable key only; the backend `SUPABASE_SECRET_KEY` remains server-side.
- **Image upload size is constrained by Vercel.** The API currently accepts files up to 5 MB, but Vercel Functions impose a 4.5 MB request-body limit, including multipart overhead ([Vercel Function limits](https://vercel.com/docs/functions/limitations)). Files near 4.5 MB may fail before reaching Express. For reliable Vercel uploads, reduce the accepted file size to about 4 MB or use direct-to-Supabase uploads.
- **Storage depends on Supabase.** Images are stored in the private `shell_images` bucket, and image responses use signed URLs. Confirm the role/RLS migration and bucket are configured before testing uploads and image display.

## Updating either app

With both Vercel projects linked to the Git repository, pushes to the production branch create production deployments and pushes to other branches create preview deployments. Each project uses its own Root Directory and environment variables. You can change them independently in the Vercel dashboard.
