const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const http = require("node:http");

const shellId = "11111111-1111-4111-8111-111111111111";
const stockTypeId = "33333333-3333-4333-8333-333333333333";
const shellImageId = "55555555-5555-4555-8555-555555555555";
const localityId = "77777777-7777-4777-8777-777777777777";
const appUsers = {
  "user-token": { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "reader@example.com" },
  "admin-token": { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "admin@example.com" },
  "superadmin-token": { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "superadmin@example.com" },
  "no-role-token": { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", email: "norole@example.com" },
  "invalid-role-token": { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", email: "invalidrole@example.com" }
};
const ids = {
  shell_description: "22222222-2222-4222-8222-222222222222",
  shell_stock_type: "44444444-4444-4444-8444-444444444444",
  shell_type: "88888888-8888-4888-8888-888888888888",
  shell_images: "66666666-6666-4666-8666-666666666666",
  shell_locality: localityId
};
let records;
let dbServer;
let apiServer;
let apiUrl;
let stockInfoNextId;
let storageObjects;
let failNextShellImageInsert;
let failNextStorageUpload;
let signedTtls;
let shellImageNextNumber;
let unitNextNumber;
let lastApiRequestAt = 0;

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}

function sendDbError(response, status, code, message) {
  sendJson(response, status, { code, message, details: null, hint: null });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function databaseHandler(request, response) {
  void (async () => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/auth/v1/user") {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      const user = appUsers[token];
      if (!user) {
        sendJson(response, 401, { message: "Invalid token" });
        return;
      }
      sendJson(response, 200, { ...user, aud: "authenticated", role: "authenticated" });
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/shell_images/")) {
      const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/sign/shell_images/".length));
      const signedRequest = await readBody(request);
      signedTtls.push(signedRequest.expiresIn);
      if (!storageObjects.has(path)) {
        sendJson(response, 400, { statusCode: "404", error: "NotFound", message: "Object not found" });
        return;
      }
      sendJson(response, 200, { signedURL: `/storage/v1/object/sign/shell_images/${path}?token=test-token` });
      return;
    }
    if (url.pathname === "/storage/v1/object/shell_images" || url.pathname.startsWith("/storage/v1/object/shell_images/")) {
      const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/shell_images".length).replace(/^\//, ""));
      if (request.method === "POST") {
        if (failNextStorageUpload) {
          failNextStorageUpload = false;
          sendJson(response, 500, { statusCode: "500", error: "InternalServerError", message: "simulated upload failure" });
          return;
        }
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        storageObjects.set(path, Buffer.concat(chunks));
        sendJson(response, 200, { Key: `shell_images/${path}` });
        return;
      }
      if (request.method === "GET") {
        const bytes = storageObjects.get(path);
        if (!bytes) {
          sendJson(response, 404, { statusCode: "404", error: "NotFound", message: "Object not found" });
          return;
        }
        response.writeHead(200, { "content-type": "image/jpeg" });
        response.end(bytes);
        return;
      }
      if (request.method === "DELETE") {
        const body = await readBody(request);
        for (const key of body.prefixes ?? []) storageObjects.delete(key);
        sendJson(response, 200, {});
        return;
      }
    }
    const table = url.pathname.slice("/rest/v1/".length);
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const authUser = appUsers[token];
    const authRole = records.user_roles.find((row) => row.user_id === authUser?.id)?.role;
    if (table === "rpc/assign_user_role" && request.method === "POST") {
      const assignment = await readBody(request);
      if (authRole !== "superadmin") {
        sendDbError(response, 403, "42501", "Only a superadmin can assign roles.");
        return;
      }
      if (assignment.target_user_id === authUser.id) {
        sendDbError(response, 403, "42501", "You cannot change your own role.");
        return;
      }
      const target = records.user_roles.find((row) => row.user_id === assignment.target_user_id);
      if (!target) {
        sendDbError(response, 404, "PGRST116", "The target user role record was not found.");
        return;
      }
      target.role = assignment.new_role;
      target.updated_at = new Date().toISOString();
      sendJson(response, 200, target);
      return;
    }
    if (table === "rpc/set_shell_main_image" && request.method === "POST") {
      const selection = await readBody(request);
      if (authRole !== "admin" && authRole !== "superadmin") {
        sendDbError(response, 403, "42501", "Only admins can select a main image.");
        return;
      }
      const image = records.shell_images.find(row => row.image_id === selection.p_image_id && row.shell_id === selection.p_shell_id);
      if (!image) { sendDbError(response, 409, "23503", "Image does not belong to shell."); return; }
      records.shell_images.filter(row => row.shell_id === selection.p_shell_id).forEach(row => { row.is_main_image = row.image_id === image.image_id; });
      sendJson(response, 200, image);
      return;
    }
    if (!Object.hasOwn(records, table)) {
      sendDbError(response, 404, "PGRST205", "Table not found");
      return;
    }

    const rows = records[table];
    if (table === "user_roles" && authRole !== "superadmin" && request.method !== "GET") {
      sendDbError(response, 403, "42501", "Role assignments are managed only through the superadmin function.");
      return;
    }
    if (table !== "user_roles" && authRole === "user" && ["POST", "PATCH", "DELETE"].includes(request.method)) {
      sendDbError(response, 403, "42501", "Only admins can mutate inventory.");
      return;
    }
    const idColumn = table === "shell_locality" ? "locality_id"
      : table === "shell_stock_type" ? "stock_id"
      : table === "shell_type" ? "type_id"
        : table === "shell_description" ? "shell_id"
          : table === "shell_images" ? "image_id"
            : table === "shell_stocks_info" ? "stock_info_id" : "id";
    let selected = rows;
    if (table === "shell_description" && url.searchParams.has("or")) {
      selected = selected.filter((row) => row.is_deleted !== true);
    }
    for (const [key, value] of url.searchParams.entries()) {
      if (value.startsWith("eq.") && key !== "select") {
        const expected = decodeURIComponent(value.slice(3));
        selected = selected.filter((row) => String(row[key]) === expected);
      } else if (value.startsWith("in.(") && key !== "select") {
        const expected = value.slice(4, -1).replaceAll('"', "").split(",");
        selected = selected.filter((row) => expected.includes(String(row[key])));
      } else if (value.startsWith("ilike.") && key !== "select") {
        const expected = decodeURIComponent(value.slice(6)).toLocaleLowerCase();
        selected = selected.filter(row => String(row[key] ?? "").toLocaleLowerCase() === expected);
      } else if (value.startsWith("neq.") && key !== "select") {
        const expected = decodeURIComponent(value.slice(4));
        selected = selected.filter(row => String(row[key]) !== expected);
      }
    }

    const method = request.method;
    const body = ["POST", "PATCH"].includes(method) ? await readBody(request) : null;
    const objectResponse = request.headers.accept?.includes("application/vnd.pgrst.object+json");
    const sendRows = (status, found, total = found.length) => {
      const range = request.headers.range?.match(/(\d+)-(\d+)/);
      const from = range ? Number(range[1]) : 0;
      const to = range ? Number(range[2]) : Math.max(total - 1, 0);
      const sliced = range ? found.slice(from, to + 1) : found;
      const contentRange = total === 0 ? "*/0" : `${from}-${Math.min(to, total - 1)}/${total}`;
      sendJson(response, status, objectResponse ? (sliced[0] ?? null) : sliced, { "content-range": contentRange });
    };

    if (method === "GET") {
      sendRows(200, selected);
      return;
    }

    if (method === "POST") {
      if (table === "shell_images" && failNextShellImageInsert) {
        failNextShellImageInsert = false;
        sendDbError(response, 500, "XX000", "simulated database insert failure");
        return;
      }
      const newRow = table === "shell_description"
        ? { shell_id: body.shell_id ?? ids.shell_description, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", shell_name: "", author: "", deepness: "", from: "", note: null, is_deleted: null, shell_stock_type_id: null, shell_type_id: null, price: null, locality_id: null, shell_weight: null, ...body }
        : table === "shell_locality"
          ? { locality_id: body.locality_id ?? ids.shell_locality, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", locality: null, ...body }
        : table === "shell_stock_type"
          ? { stock_id: body.stock_id ?? ids.shell_stock_type, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", stock_name: null, ...body }
          : table === "shell_type"
            ? { type_id: body.type_id ?? ids.shell_type, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", shell_type_name: "", ...body }
            : table === "shell_stocks_info"
              ? { stock_info_id: body.stock_info_id ?? stockInfoNextId++, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", shell_id: null, shell_stock_id: null, shell_stock: null, shell_pcs_per_stock: null, shell_total_available: null, ...body }
              : table === "unit_of_measurement"
                ? { id: body.id ?? `99999999-9999-4999-8999-${String(unitNextNumber++).padStart(12, "0")}`, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", unit_name: null, measurement_for: null, ...body }
                : { image_id: body.image_id ?? `66666666-6666-4666-8666-${String(shellImageNextNumber++).padStart(12, "0")}`, created_at: body.created_at ?? "2026-10-14T00:00:00.000Z", file_name: "", storage_path: null, is_main_image: null, shell_id: null, ...body };

      if (rows.some((row) => String(row[idColumn]) === String(newRow[idColumn]))) {
        sendDbError(response, 409, "23505", "duplicate key value violates unique constraint");
        return;
      }
      if (table === "shell_stocks_info") {
        if (newRow.shell_id && !records.shell_description.some((row) => row.shell_id === newRow.shell_id)) {
          sendDbError(response, 409, "23503", "shell_id foreign key violation");
          return;
        }
        if (newRow.shell_stock_id && !records.shell_stock_type.some((row) => row.stock_id === newRow.shell_stock_id)) {
          sendDbError(response, 409, "23503", "shell_stock_id foreign key violation");
          return;
        }
      }
      if (table === "shell_description" && newRow.locality_id && !records.shell_locality.some((row) => row.locality_id === newRow.locality_id)) {
        sendDbError(response, 409, "23503", "locality_id foreign key violation");
        return;
      }
      if (table === "shell_images" && newRow.shell_id && !records.shell_description.some((row) => row.shell_id === newRow.shell_id)) {
        sendDbError(response, 409, "23503", "shell_id foreign key violation");
        return;
      }
      rows.push(newRow);
      sendRows(201, [newRow]);
      return;
    }

    if (method === "PATCH") {
      if (!selected.length) {
        sendRows(200, []);
        return;
      }
      const updated = Object.assign(selected[0], body);
      if (table === "shell_stocks_info") {
        if (updated.shell_id && !records.shell_description.some((row) => row.shell_id === updated.shell_id)) {
          sendDbError(response, 409, "23503", "shell_id foreign key violation");
          return;
        }
        if (updated.shell_stock_id && !records.shell_stock_type.some((row) => row.stock_id === updated.shell_stock_id)) {
          sendDbError(response, 409, "23503", "shell_stock_id foreign key violation");
          return;
        }
      }
      if (table === "shell_description" && updated.locality_id && !records.shell_locality.some((row) => row.locality_id === updated.locality_id)) {
        sendDbError(response, 409, "23503", "locality_id foreign key violation");
        return;
      }
      if (table === "shell_images" && updated.shell_id && !records.shell_description.some((row) => row.shell_id === updated.shell_id)) {
        sendDbError(response, 409, "23503", "shell_id foreign key violation");
        return;
      }
      sendRows(200, [updated]);
      return;
    }

    if (method === "DELETE") {
      if (table === "shell_stock_type" && records.shell_stocks_info.some((row) => row.shell_stock_id === selected[0]?.stock_id)) {
        sendDbError(response, 409, "23503", "stock type is referenced by stock_info");
        return;
      }
      if (table === "shell_locality" && records.shell_description.some((row) => row.locality_id === selected[0]?.locality_id)) {
        sendDbError(response, 409, "23503", "locality is referenced by shell_description");
        return;
      }
      if (table === "shell_description" && records.shell_images.some((row) => row.shell_id === selected[0]?.shell_id)) {
        sendDbError(response, 409, "23503", "shell is referenced by shell_images");
        return;
      }
      records[table] = rows.filter((row) => !selected.includes(row));
      sendRows(200, selected);
      return;
    }

    sendDbError(response, 405, "PGRST102", "Unsupported method");
  })().catch((error) => sendJson(response, 500, { message: error.message }));
}

before(async () => {
  records = {
    shell_description: [{ shell_id: shellId, created_at: "2026-10-13T00:00:00.000Z", shell_name: "Tiger Cowrie", author: "Linnaeus", locality_id: localityId, price: 25, shell_weight: "12.5 g", shell_size: "5–7 cm", deepness: "Shallow water", from: "Collected", note: null, is_deleted: false, shell_stock_type_id: stockTypeId, shell_type_id: ids.shell_type }],
    shell_stock_type: [{ stock_id: stockTypeId, created_at: "2026-10-13T00:00:00.000Z", stock_name: "Bulk" }],
    shell_type: [{ type_id: ids.shell_type, created_at: "2026-10-13T00:00:00.000Z", shell_type_name: "Cowrie" }],
    shell_locality: [{ locality_id: localityId, created_at: "2026-10-13T00:00:00.000Z", locality: "Philippines" }],
    shell_stocks_info: [{ stock_info_id: 101, created_at: "2026-10-13T00:00:00.000Z", shell_id: shellId, shell_stock_id: stockTypeId, shell_stock: 2.5, shell_pcs_per_stock: 12, shell_total_available: 30 }],
    shell_images: [{ image_id: shellImageId, created_at: "2026-10-13T00:00:00.000Z", file_name: "tiger-cowrie.jpg", storage_path: null, is_main_image: false, shell_id: shellId }],
    unit_of_measurement: [{ id: "99999999-9999-4999-8999-000000000001", created_at: "2026-10-13T00:00:00.000Z", unit_name: "cm", measurement_for: "size" }, { id: "99999999-9999-4999-8999-000000000002", created_at: "2026-10-13T00:00:00.000Z", unit_name: "g", measurement_for: "weight" }],
    user_roles: [
      { user_id: appUsers["user-token"].id, email: appUsers["user-token"].email, role: "user", created_at: "2026-10-15T00:00:00.000Z", updated_at: "2026-10-15T00:00:00.000Z" },
      { user_id: appUsers["admin-token"].id, email: appUsers["admin-token"].email, role: "admin", created_at: "2026-10-15T00:00:00.000Z", updated_at: "2026-10-15T00:00:00.000Z" },
      { user_id: appUsers["superadmin-token"].id, email: appUsers["superadmin-token"].email, role: "superadmin", created_at: "2026-10-15T00:00:00.000Z", updated_at: "2026-10-15T00:00:00.000Z" },
      { user_id: appUsers["invalid-role-token"].id, email: appUsers["invalid-role-token"].email, role: "owner", created_at: "2026-10-15T00:00:00.000Z", updated_at: "2026-10-15T00:00:00.000Z" }
    ]
  };
  stockInfoNextId = 102;
  storageObjects = new Map();
  failNextShellImageInsert = false;
  failNextStorageUpload = false;
  signedTtls = [];
  shellImageNextNumber = 1;
  unitNextNumber = 3;

  dbServer = http.createServer(databaseHandler);
  await new Promise((resolve) => dbServer.listen(0, "127.0.0.1", resolve));
  const dbAddress = dbServer.address();
  process.env.SUPABASE_URL = `http://127.0.0.1:${dbAddress.port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  process.env.SUPABASE_SIGNED_URL_TTL_SECONDS = "120";
  process.env.PAYPAL_MODE = "sandbox";
  process.env.PAYPAL_CLIENT_ID = "";
  process.env.PAYPAL_CLIENT_SECRET = "";
  process.env.PAYPAL_CURRENCY = "";
  process.env.PAYPAL_DELIVERY_FEE = "0";

  const app = require("../dist/app.js").default;
  apiServer = http.createServer(app);
  await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  await Promise.all([dbServer, apiServer].map((server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

async function api(path, options = {}) {
  const waitMs = Math.max(0, 120 - (Date.now() - lastApiRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastApiRequestAt = Date.now();
  const { token = "admin-token", ...fetchOptions } = options;
  const isFormData = fetchOptions.body instanceof FormData;
  const response = await fetch(`${apiUrl}${path}`, {
    ...fetchOptions,
    headers: { ...(isFormData ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...fetchOptions.headers },
    body: fetchOptions.body ? (isFormData ? fetchOptions.body : JSON.stringify(fetchOptions.body)) : undefined
  });
  return { status: response.status, body: await response.json() };
}

test("public catalog reads need no customer login while inventory writes and role assignment stay protected", async () => {
  assert.equal((await api("/api/shells", { token: null })).status, 200);
  assert.equal((await api("/api/shell-types", { token: null })).status, 200);
  assert.equal((await api("/api/shell-images", { token: null })).status, 200);
  assert.equal((await api("/api/shell-stock-types", { token: null })).status, 401);
  assert.equal((await api("/api/shell-stocks-info", { token: null })).status, 401);
  assert.equal((await api("/api/shell-stock-types", { token: "user-token" })).status, 403);
  assert.equal((await api("/api/shell-stocks-info", { token: "user-token" })).status, 403);
  assert.equal((await api("/api/shells", { method: "POST", token: null, body: { shell_name: "Anonymous write" } })).status, 401);
  assert.equal((await api("/api/shells", { token: "invalid-token" })).status, 401);
  assert.equal((await api("/api/auth/me", { token: "no-role-token" })).status, 403);
  assert.equal((await api("/api/auth/me", { token: "invalid-role-token" })).status, 403);

  const me = await api("/api/auth/me", { token: "user-token" });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.role, "user");
  assert.equal((await api("/api/shells", { token: "user-token" })).status, 200);
  assert.equal((await api("/api/shells", { method: "POST", token: "user-token", body: { shell_name: "No write access" } })).status, 403);
  assert.equal((await api("/api/auth/users", { token: "admin-token" })).status, 403);
  assert.equal((await api("/api/auth/users", { token: "superadmin-token" })).status, 200);

  const cannotSelfPromote = await api(`/api/auth/users/${appUsers["user-token"].id}/role`, {
    method: "PATCH", token: "user-token", body: { role: "superadmin" }
  });
  assert.equal(cannotSelfPromote.status, 403);
  const cannotSelfChange = await api(`/api/auth/users/${appUsers["superadmin-token"].id}/role`, {
    method: "PATCH", token: "superadmin-token", body: { role: "user" }
  });
  assert.equal(cannotSelfChange.status, 403);
  const invalidRole = await api(`/api/auth/users/${appUsers["user-token"].id}/role`, {
    method: "PATCH", token: "superadmin-token", body: { role: "owner" }
  });
  assert.equal(invalidRole.status, 400);

  const promoted = await api(`/api/auth/users/${appUsers["user-token"].id}/role`, {
    method: "PATCH", token: "superadmin-token", body: { role: "admin" }
  });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.body.data.role, "admin");
});

test("health and shell description CRUD use Supabase", async () => {
  assert.deepEqual(await (await fetch(`${apiUrl}/health`)).json(), { status: "ok" });
  const list = await api("/api/shells?limit=10&sort_by=shell_name&sort_order=asc");
  assert.equal(list.status, 200);
  assert.equal(list.body.data[0].shell_name, "Tiger Cowrie");
  assert.equal(list.body.pagination.total, 1);
  assert.equal((await api(`/api/shells/${shellId}`)).status, 200);

  const created = await api("/api/shells", { method: "POST", body: { shell_name: "Sunrise Tellin", is_deleted: false } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match(created.body.data.shell_id, /^[0-9a-f-]{36}$/i);
  assert.equal(created.body.data.shell_stock_type_id, null);

  const updated = await api(`/api/shells/${created.body.data.shell_id}`, { method: "PATCH", body: { locality_id: localityId, price: 42.5, shell_weight: "18.25 oz", shell_size: "approximately 3 inches" } });
  assert.equal(updated.body.data.locality_id, localityId);
  assert.equal(updated.body.data.price, 42.5);
  assert.equal(updated.body.data.shell_weight, "18.25 oz");
  assert.equal(updated.body.data.shell_size, "approximately 3 inches");
  const deleted = await api(`/api/shells/${shellId}`, { method: "DELETE" });
  assert.equal(deleted.body.data.is_deleted, true);
  assert.equal((await api(`/api/shells/${shellId}`)).status, 404);
});

test("guest commerce config is public while guest cart data requires a shop capability token", async () => {
  const config = await api("/api/shop/config", { token: null });
  assert.equal(config.status, 200);
  assert.equal(config.body.data.checkout_enabled, false);
  assert.equal(config.body.data.currency, null);
  assert.equal(Object.hasOwn(config.body.data, "paypal_client_secret"), false);
  assert.equal((await api("/api/shop/cart", { token: null })).status, 401);
  assert.equal((await api("/api/shop/availability?ids=invalid", { token: null })).status, 400);
});

test("shell stock types support CRUD and preserve FK constraints", async () => {
  assert.equal((await api("/api/shell-stock-types?limit=10&stock_name=Bulk")).body.data.length, 1);
  assert.equal((await api(`/api/shell-stock-types/${stockTypeId}`)).status, 200);
  const created = await api("/api/shell-stock-types", { method: "POST", body: { stock_name: "Retail" } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const updated = await api(`/api/shell-stock-types/${created.body.data.stock_id}`, { method: "PATCH", body: { stock_name: "Retail bag" } });
  assert.equal(updated.body.data.stock_name, "Retail bag");
  assert.equal((await api(`/api/shell-stock-types/${stockTypeId}`, { method: "DELETE" })).status, 409);
  assert.equal((await api(`/api/shell-stock-types/${created.body.data.stock_id}`, { method: "DELETE" })).status, 200);
});

test("shell types support CRUD and filter shell descriptions", async () => {
  const list = await api("/api/shell-types?limit=10&shell_type_name=Cowrie");
  assert.equal(list.status, 200);
  assert.equal(list.body.data[0].type_id, ids.shell_type);
  const newTypeId = "99999999-9999-4999-8999-999999999999";
  const created = await api("/api/shell-types", { method: "POST", body: { type_id: newTypeId, shell_type_name: "Conch" } });
  assert.equal(created.status, 201);
  const updated = await api(`/api/shell-types/${created.body.data.type_id}`, { method: "PATCH", body: { shell_type_name: "Conch shell" } });
  assert.equal(updated.body.data.shell_type_name, "Conch shell");
  const filteredShells = await api(`/api/shells?shell_type_id=${ids.shell_type}&include_deleted=true`);
  assert.equal(filteredShells.body.data[0].shell_id, shellId);
  assert.equal((await api(`/api/shell-types/${created.body.data.type_id}`, { method: "DELETE" })).status, 200);
});

test("shell localities support CRUD and shell locality, price, and weight schema", async () => {
  const filtered = await api("/api/shell-localities?locality=Philippines");
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.data[0].locality_id, localityId);
  assert.equal((await api(`/api/shell-localities/${localityId}`)).body.data.locality, "Philippines");
  assert.equal((await api(`/api/shell-localities/${localityId}`, { method: "DELETE" })).status, 409);

  const newId = "12121212-1212-4121-8121-121212121212";
  const created = await api("/api/shell-localities", { method: "POST", body: { locality_id: newId, locality: "Cebu" } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const updated = await api(`/api/shell-localities/${newId}`, { method: "PATCH", body: { locality: "Cebu, Philippines" } });
  assert.equal(updated.body.data.locality, "Cebu, Philippines");
  assert.equal((await api(`/api/shell-localities/${newId}`, { method: "DELETE" })).status, 200);

  const shellList = await api(`/api/shells?locality_id=${localityId}&price=25&include_deleted=true`);
  assert.equal(shellList.status, 200);
  assert.equal(shellList.body.data[0].locality_id, localityId);
  assert.equal(shellList.body.data[0].price, 25);
  assert.equal(shellList.body.data[0].shell_weight, "12.5 g");
  assert.equal(shellList.body.data[0].shell_size, "5–7 cm");
  assert.equal((await api(`/api/shells?shell_weight=12.5%20g&include_deleted=true`)).body.data[0].shell_id, shellId);
  assert.equal((await api("/api/shells", { method: "POST", body: { shell_weight: 12.5 } })).status, 400);
  const invalidLocality = await api("/api/shells", { method: "POST", body: { locality_id: newId, price: 10 } });
  assert.equal(invalidLocality.status, 409);
  assert.equal((await api("/api/shells", { method: "POST", body: { price: "not-a-number" } })).status, 400);
});

test("measurement units are admin-managed, category-filtered, validated, and editable", async () => {
  assert.equal((await api("/api/units", { token: null })).status, 401);
  assert.equal((await api("/api/units", { token: "invalid-role-token" })).status, 403);
  const standardPage = await api("/api/units?limit=12&offset=0&sort_by=created_at&sort_order=desc");
  assert.equal(standardPage.status, 200);
  assert.equal(standardPage.body.pagination.total, 2);
  const sizes = await api("/api/units?limit=12&offset=0&sort_by=created_at&sort_order=desc&measurement_for=size");
  assert.deepEqual(sizes.body.data.map(unit => unit.unit_name), ["cm"]);
  assert.deepEqual(sizes.body.pagination, { limit: 12, offset: 0, total: 1 });
  const created = await api("/api/units", { method: "POST", body: { unit_name: "inch", measurement_for: "size" } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const duplicate = await api("/api/units", { method: "POST", body: { unit_name: "inch", measurement_for: "size" } });
  assert.equal(duplicate.status, 409);
  const invalid = await api("/api/units", { method: "POST", body: { unit_name: "oz", measurement_for: "Weight" } });
  assert.equal(invalid.status, 400);
  const updated = await api(`/api/units/${created.body.data.id}`, { method: "PATCH", body: { measurement_for: "weight" } });
  assert.equal(updated.body.data.measurement_for, "weight");
  assert.equal((await api(`/api/units/${created.body.data.id}`, { method: "DELETE" })).status, 200);
});

test("shell stocks info supports CRUD, filtering, numeric fields, and FK validation", async () => {
  const list = await api(`/api/shell-stocks-info?shell_id=${shellId}&limit=10&sort_by=stock_info_id`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data[0].shell_stock, 2.5);
  assert.equal(list.body.data[0].shell_total_available, 30);
  assert.equal((await api("/api/shell-stocks-info/101")).status, 200);

  const created = await api("/api/shell-stocks-info", { method: "POST", body: { shell_id: shellId, shell_stock_id: stockTypeId, shell_stock: 3, shell_pcs_per_stock: 10, shell_total_available: 30 } });
  assert.equal(created.status, 201);
  const updated = await api(`/api/shell-stocks-info/${created.body.data.stock_info_id}`, { method: "PATCH", body: { shell_stock: 4.25 } });
  assert.equal(updated.body.data.shell_stock, 4.25);
  assert.equal((await api(`/api/shell-stocks-info/${created.body.data.stock_info_id}`, { method: "DELETE" })).status, 200);
  const invalidForeignKey = await api("/api/shell-stocks-info", { method: "POST", body: { shell_id: "99999999-9999-4999-8999-999999999999" } });
  assert.equal(invalidForeignKey.status, 409);
  assert.equal(invalidForeignKey.body.database.code, "23503");
  assert.match(invalidForeignKey.body.database.message, /foreign key violation/i);
  assert.equal((await api("/api/shell-stocks-info/not-an-integer")).status, 400);
});

test("shell images support CRUD and referenced shell integrity", async () => {
  const initialList = await api(`/api/shell-images?shell_id=${shellId}&limit=10`);
  assert.equal(initialList.body.data[0].file_name, "tiger-cowrie.jpg");
  assert.equal(initialList.body.data[0].image_url, null);
  const batchList = await api(`/api/shell-images?shell_ids=${shellId}&limit=10`);
  assert.equal(batchList.status, 200);
  assert.equal(batchList.body.data[0].shell_id, shellId);
  assert.equal((await api(`/api/shell-images/${shellImageId}`)).status, 200);
  const form = new FormData();
  form.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "new-shell.jpg");
  form.set("shell_id", shellId);
  const created = await api("/api/shell-images", { method: "POST", body: form });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match(created.body.data.storage_path, /^[0-9a-f-]{36}\.jpg$/);
  assert.match(created.body.data.image_url, /token=test-token/);
  assert.ok(created.body.data.image_url_expires_at);
  assert.ok(Math.abs(new Date(created.body.data.image_url_expires_at).getTime() - Date.now() - 120_000) < 5000);
  assert.equal(signedTtls.at(-1), 120);
  assert.equal(storageObjects.size, 1);
  const savedBytes = storageObjects.get(created.body.data.storage_path);
  storageObjects.delete(created.body.data.storage_path);
  assert.equal((await api(`/api/shell-images/${created.body.data.image_id}`)).body.data.image_url, null);
  storageObjects.set(created.body.data.storage_path, savedBytes);

  const sameName = new FormData();
  sameName.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "new-shell.jpg");
  sameName.set("shell_id", shellId);
  const duplicateName = await api("/api/shell-images", { method: "POST", body: sameName });
  assert.equal(duplicateName.status, 201);
  assert.notEqual(duplicateName.body.data.storage_path, created.body.data.storage_path);
  const listed = await api(`/api/shell-images?shell_id=${shellId}&limit=10`);
  assert.ok(listed.body.data.some((image) => image.image_id === created.body.data.image_id && image.image_url));
  const updated = await api(`/api/shell-images/${created.body.data.image_id}`, { method: "PATCH", body: { file_name: "renamed.jpg" } });
  assert.equal(updated.body.data.file_name, "renamed.jpg");
  assert.equal((await api(`/api/shell-images/${created.body.data.image_id}`, { method: "DELETE" })).status, 200);
  assert.equal((await api(`/api/shell-images/${duplicateName.body.data.image_id}`, { method: "DELETE" })).status, 200);
  assert.equal(storageObjects.size, 0);
  const invalidForeignKeyForm = new FormData();
  invalidForeignKeyForm.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "orphan.jpg");
  invalidForeignKeyForm.set("shell_id", "99999999-9999-4999-8999-999999999999");
  const invalidForeignKey = await api("/api/shell-images", { method: "POST", body: invalidForeignKeyForm });
  assert.equal(invalidForeignKey.status, 409);
  assert.equal(storageObjects.size, 0);
});

test("main image selection is persisted atomically and cannot be unset or deleted without replacement", async () => {
  const selected = await api(`/api/shell-images/${shellImageId}`, { method: "PATCH", body: { is_main_image: true } });
  assert.equal(selected.status, 200);
  assert.equal(records.shell_images.find(image => image.image_id === shellImageId).is_main_image, true);
  assert.equal((await api(`/api/shell-images/${shellImageId}`, { method: "PATCH", body: { is_main_image: false } })).status, 400);
  assert.equal((await api(`/api/shell-images/${shellImageId}`, { method: "DELETE" })).status, 400);
});

test("shell image uploads reject unsupported and oversized images and roll back failed inserts", async () => {
  const unsupported = new FormData();
  unsupported.set("image", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
  assert.equal((await api("/api/shell-images", { method: "POST", body: unsupported })).status, 415);

  const mismatchedSignature = new FormData();
  mismatchedSignature.set("image", new Blob(["not jpeg bytes"], { type: "image/jpeg" }), "fake.jpg");
  assert.equal((await api("/api/shell-images", { method: "POST", body: mismatchedSignature })).status, 415);

  failNextStorageUpload = true;
  const failedUpload = new FormData();
  failedUpload.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "failed.jpg");
  assert.equal((await api("/api/shell-images", { method: "POST", body: failedUpload })).status, 502);

  const oversized = new FormData();
  oversized.set("image", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }), "large.jpg");
  assert.equal((await api("/api/shell-images", { method: "POST", body: oversized })).status, 413);

  failNextShellImageInsert = true;
  const valid = new FormData();
  valid.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "rollback.jpg");
  const failedInsert = await api("/api/shell-images", { method: "POST", body: valid });
  assert.equal(failedInsert.status, 500);
  assert.equal(storageObjects.size, 0);
});

test("validates request bodies, route IDs, query parameters, and malformed JSON", async () => {
  assert.equal((await api("/api/shells/not-a-uuid")).status, 400);
  assert.equal((await api("/api/shell-stock-types", { method: "POST", body: { unexpected: true } })).status, 400);
  assert.equal((await api("/api/shell-stocks-info", { method: "POST", body: { shell_stock: "many" } })).status, 400);
  const invalidUpload = new FormData();
  invalidUpload.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "image.jpg");
  invalidUpload.set("shell_id", "not-a-uuid");
  assert.equal((await api("/api/shell-images", { method: "POST", body: invalidUpload })).status, 400);
  assert.equal((await api("/api/shells?limit=1000")).status, 400);
  const malformed = await fetch(`${apiUrl}/api/shells`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
});

test("returns 404 for missing records and 409 for duplicate keys", async () => {
  assert.equal((await api("/api/shells/99999999-9999-4999-8999-999999999999")).status, 404);
  assert.equal((await api(`/api/shells/${shellId}`, { method: "POST", body: {} })).status, 404);
  const duplicate = await api("/api/shell-stock-types", { method: "POST", body: { stock_id: stockTypeId } });
  assert.equal(duplicate.status, 409);
});

