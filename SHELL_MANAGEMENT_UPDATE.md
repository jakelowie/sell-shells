# Shell Management Update

## 1. Overview

This update adds free-text shell size and weight values, admin management for measurement units, combined shell and image editing, persisted main-image selection, and storefront presentation changes. Existing shell-weight numeric values are cast to text by the migration so their displayed numeric content remains intact.

## 2. Architecture Review

The application uses a React and TypeScript frontend built with Vite, an Express and TypeScript API, Zod request validation, and Supabase PostgREST and Storage. Admin requests carry a Supabase access token; API middleware resolves roles from `user_roles`. Shell image files use the private `shell_images` bucket, UUID-based object paths, and signed URLs. The frontend originally managed shell descriptions and images in separate inventory flows.

The live Supabase schema was not reachable from this environment (`fetch failed` on a read-only request), so the existing unit rows, category spellings, deployed RLS policies, and main-image data could not be inspected. The supplied table definitions were used for the implementation.

## 3. Database Changes

Migration: `supabase/migrations/20261024010000_shell_measurements_and_main_image.sql`.

- Casts `shell_description.shell_weight` from numeric to text using PostgreSQL's text cast. Existing numeric values remain represented as text; no unit is inferred or appended.
- Keeps `shell_size` as text and does not add any measurement foreign keys. Both size and weight values include their unit in the text when an admin selects one.
- Demotes duplicate main images, then assigns the earliest image as main for shells that have images but no main image.
- Adds a partial unique index allowing at most one `is_main_image = true` row per non-null `shell_id`.
- Adds the `set_shell_main_image` transaction function. It locks the parent shell, validates the image belongs to that shell, and changes the main selection atomically.
- Enables RLS on `unit_of_measurement` and limits access to admins and superadmins through `user_roles`.

The UI/API require at least one image and an explicitly selected main image when a shell is saved. PostgreSQL does not enforce that every shell has a child image; existing shells with no images need an image added through the admin UI.

## 4. API Changes

All unit endpoints require an admin or superadmin bearer token:

- `GET /api/units?limit=12&offset=0&sort_by=created_at&sort_order=desc&measurement_for=size` lists paginated units; `measurement_for` and `unit_name` are optional filters. `sort_by` accepts `created_at`, `unit_name`, or `measurement_for`.
- `GET /api/units/:id` retrieves one unit.
- `POST /api/units` creates `{ "unit_name": "cm", "measurement_for": "size" }`.
- `PATCH /api/units/:id` updates the name or category.
- `DELETE /api/units/:id` deletes the catalog row. Shell values are free text and are not rewritten when a unit is deleted.

Names are trimmed and validated; categories are the lowercase values `size` and `weight`; duplicate names within a category are rejected by the API. Shell descriptions accept bounded free-text `shell_size` and `shell_weight` fields. Shell image updates with `is_main_image: true` use the atomic database function. Attempts to unset or delete the current main image without first choosing a replacement are rejected.

## 5. Admin UI Changes

The shell form accepts descriptive size and weight text and offers optional dropdowns from the corresponding unit category. Selecting an already-present trailing unit does not append it twice; leaving the dropdown empty preserves the entered text. Editing a legacy value does not attempt to parse or rewrite it. The measurement-units inventory section provides add, edit, and delete operations with the existing record modal and table conventions.

The shell form also displays current images, previews newly selected files, supports removing images and selecting the main image, and uploads additional files from the same modal. The separate image library remains available. The save flow preserves existing images unless explicitly removed.

## 6. Customer Storefront Changes

The large shell artwork has been removed from the customer landing hero; its introduction and collection link remain. Product cards now use larger image areas and typography, with responsive overrides for smaller screens. Cards only use a persisted main image; missing main images or failed URLs fall back to the existing placeholder. Product details continue to load all shell images and now display shell size and the stored weight text without a hard-coded `kg` suffix.

## 7. Image Storage Behavior

Uploads continue using the `shell_images` bucket, UUID object names, and existing signed URL generation. Shell images uploaded in the combined modal are first stored as non-main; after all uploads succeed, the selected image is made main atomically. The new partial unique index prevents concurrent or direct API changes from leaving multiple main images. Removed images are deleted through the existing endpoint, which deletes storage content and metadata with compensating restoration on database failure.

## 8. Measurement Handling

Shell size and weight are free text. The form appends an optional selected unit to the text value (for example, `5–7 cm` or `20 g`), without numeric parsing or unit conversion. Existing values remain editable as entered, including values whose unit is unknown. `unit_of_measurement.measurement_for` is queried by the canonical lowercase categories `size` and `weight`; no units are seeded.

## 9. Files Changed

- `.gitignore` — allows migration files to be tracked while continuing to ignore other Supabase-local content.
- `supabase/migrations/20261024010000_shell_measurements_and_main_image.sql` — weight conversion, main-image repair/index/function, and unit-table RLS policy.
- `src/app.ts` — mounts the protected units API.
- `src/models/database.ts` — adds unit table and main-image function types.
- `src/validation/shell-description.ts` — accepts size and weight text.
- `src/validation/unit.ts` — adds unit request schemas.
- `src/services/units.service.ts` — unit CRUD and duplicate checking.
- `src/routes/units.ts` — authenticated unit endpoints.
- `swagger.json` — changes shell measurement types to text.
- `src/services/shell-images.service.ts` — uses atomic main-image selection and prevents unsetting/deleting the current main image.
- `frontend/src/shared/api/types.ts` — updates shell measurement types and adds the measurement-unit type.
- `frontend/src/shared/api/index.ts` — exports the unit type.
- `frontend/src/shared/api/storefront.ts` — selects only persisted main images for cards.
- `frontend/src/features/inventory/types.ts` — adds the units inventory section.
- `frontend/src/features/inventory/api/inventoryApi.ts` — adds unit CRUD support and combined shell/image persistence.
- `frontend/src/features/inventory/components/RecordModal.tsx` — adds measurement fields, unit selectors, image previews, main selection, and removal controls.
- `frontend/src/features/inventory/components/InventoryTable.tsx` — displays size, weight, and units.
- `frontend/src/features/inventory/InventoryPage.tsx` — adds the units section and loads unit and image data for forms.
- `frontend/src/features/storefront/CustomerApp.tsx` — removes hero artwork and displays measurement text.
- `frontend/src/shared/styles.css` — styles pending image previews and responsive storefront changes.
- `tests/shells.test.cjs` — covers text measurements in shell API behavior.
- `tests/measurements.test.cjs` — validates free-text measurements and unit categories.
- `SHELL_MANAGEMENT_UPDATE.md` — documents this implementation.

## 10. Testing and Verification

- `npm run build` in the project root — passed.
- `npm run build` in `frontend` — passed.
- `npm test` — measurement schema tests passed, but the existing HTTP integration suite could not connect to its local test API (`fetch failed`) in this restricted environment. The suite reported 8 passing and 11 failing tests; the failures were connection failures before test assertions, so the integration behavior is not verified here.
- A read-only Supabase query for existing unit rows also failed with `fetch failed`; no live schema/data operation was performed.

## 11. Setup and Deployment

1. Review and apply the migration in the Supabase SQL editor after the existing `user_roles` and inventory RLS setup is installed.
2. Confirm the target project exposes the `unit_of_measurement` table through PostgREST and grants authenticated users table access subject to RLS.
3. Confirm `measurement_for` data uses lowercase `size` and `weight`, or map/normalize the existing categories before enabling the corresponding dropdowns. No default units are inserted.
4. Deploy the API and frontend builds. Keep `SUPABASE_SECRET_KEY` server-only; the API continues to use it only for Storage and commerce operations.
5. Review shells that currently have no images and add at least one image with a main selection in the admin UI.

## 12. Known Limitations

- The migration has not been executed against Supabase in this environment. Review it against the target project before deployment.
- Existing unit category values could not be inspected. Dropdowns and validation currently use the lowercase `size` and `weight` values.
- Cross-request storage and PostgREST workflows use compensating cleanup, not a single transaction spanning Storage and database operations. The main-image change itself is atomic.
- The database index guarantees at most one main image; the combined admin workflow enforces at least one image and one selected main image for saves. A shell with no image cannot be assigned a main image until an image is uploaded.
- No live Supabase RLS or Storage policy behavior was exercised; deployment verification remains necessary.
