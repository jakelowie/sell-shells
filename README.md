# sell-shells

Express and TypeScript APIs for the five supplied `public` tables, backed by Supabase. The API is organized into routes, controllers, services, Zod validators, and typed database models.

## Getting started

```sh
npm install
Copy-Item .env.example .env
```

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY` in `.env`. Keep `.env` private; it is excluded from Git. The publishable key uses the project's grants and Row Level Security policies for database access. The secret key is used only by the server for private Storage uploads, deletion, and signed URL generation. Never expose it in a frontend or API response. The API listens on `http://localhost:3000` by default; set `PORT` to change it.

Before using image uploads, run the SQL migrations in `supabase/migrations` in the Supabase SQL editor. They add the `storage_path` and `is_main_image` columns and configure the private `shell_images` bucket with a 5 MB limit and supported image MIME types. Database RLS must allow the API's publishable-key role to select and insert `shell_images` rows (and update/delete if those endpoints are used). Signed URL lifetime defaults to one hour and can be set with `SUPABASE_SIGNED_URL_TTL_SECONDS` from 60 to 604800 seconds.

```sh
npm run dev
```

## CRUD endpoints

Every resource supports `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, and `DELETE /:id` under its base path:

- `/api/shells` — `shell_description`; DELETE is a soft delete setting `is_deleted=true`, preserving child references. Reads hide records where `is_deleted=true` unless `include_deleted=true`.
- `/api/shell-stock-types` — `shell_stock_type`; DELETE is physical and returns `409` if a `shell_stocks_info` row references it.
- `/api/shell-types` — `shell_type`; CRUD for shell type names, keyed by `type_id`.
- `/api/shell-stocks-info` — `shell_stocks_info`; supports the declared `shell_id` and `shell_stock_id` foreign keys. `shell_total_available` is computed as `shell_stock * shell_pcs_per_stock` on create and update (null when either input is null). Its `stock_info_id` is a bigint identity. `/api/stock-info` remains as a backward-compatible alias.
- `/api/shell-images` — `shell_images`, keyed by `image_id`; POST accepts `multipart/form-data` with an `image` file plus optional `shell_id` and `is_main_image`. PATCH can change `is_main_image`. The boolean can also be used as a collection filter (`?is_main_image=true|false`) and sort column. The API stores a collision-resistant object path in `storage_path` and the original filename in `file_name`. GET collection and item responses include a dynamically generated `image_url` and `image_url_expires_at`; rows without a valid path or whose object is missing return these as `null`. Uploads support JPEG, PNG, WebP, and GIF up to 5 MB. DELETE removes the object and metadata row; the schema's `ON DELETE RESTRICT` applies if deleting a referenced parent shell directly in the database.

Collection routes support `limit` (1–100, default 50), `offset` (default 0), `sort_by` (allowlisted per table), and `sort_order=asc|desc`. Table-specific filters include `shell_name`, `author`, `locality`, `shell_stock_type_id`, `shell_type_id`, `include_deleted`; `stock_name`; `shell_type_name`; `shell_id`, `shell_stock_id`; or `shell_id`, `file_name` respectively. Responses include `data` and `pagination` with `limit`, `offset`, and `total`.

The APIs validate request bodies, path IDs, and query parameters with **Zod**. Database defaults are omitted safely when fields aren’t supplied. Foreign-key and uniqueness errors are returned as `409`; malformed or invalid values are `400`; missing records are `404`.

The API currently allows cross-origin browser requests from any origin (`Access-Control-Allow-Origin: *`) and answers preflight `OPTIONS` requests. This is CORS configuration, not authentication: API routes remain publicly accessible, including write and delete operations.

Requests are limited to 10 per client IP in each one-second window. CORS preflight `OPTIONS` requests are excluded. The current limiter keeps counters in process memory, so when deployed as serverless functions each running instance enforces its own limit; use a shared rate-limit store for a globally consistent limit across instances.

## Table metadata

- `GET /api/table/columns/:tablename` — list exposed columns and data types. This endpoint requires `SUPABASE_SECRET_KEY` to read Supabase's OpenAPI schema; keep that key server-side.

## Insomnia

Import [sell-shells.insomnia.json](sell-shells.insomnia.json) for ready-made requests across all five tables. After creating records, copy returned IDs into the collection environment. `shell_id`, `shell_stock_type_id`, and `shell_type_id` in relational requests must refer to rows that exist in your project.

## Swagger / OpenAPI

The interactive Swagger UI is available at `http://localhost:3000/api-docs` while the API is running. The raw OpenAPI 3.1 JSON document is served at `http://localhost:3000/api-docs.json` and is also available as [swagger.json](swagger.json) for importing into Swagger Editor or another OpenAPI-compatible tool.

## Verification

- `npm run build` — TypeScript compile
- `npm test` — build plus HTTP-level tests against a local mock Supabase REST server

There is no lint script configured in this project.
