import { Router } from "express";

const router = Router();

interface OpenApiSchema {
  type?: string;
  format?: string;
  nullable?: boolean;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  $ref?: string;
}

interface OpenApiDocument {
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, OpenApiSchema> };
  definitions?: Record<string, OpenApiSchema>;
}

function resolveSchema(schema: OpenApiSchema, document: OpenApiDocument): OpenApiSchema {
  if (!schema.$ref) return schema;
  const [section, name] = schema.$ref.replace(/^#\//, "").split("/");
  if (section === "definitions" && name) return document.definitions?.[name] ?? {};
  if (section === "components" && name === "schemas") {
    const schemaName = schema.$ref.split("/")[3];
    return schemaName ? document.components?.schemas?.[schemaName] ?? {} : {};
  }
  return {};
}

router.get("/columns/:tablename", async (request, response) => {
  const tableName = request.params.tablename;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    return response.status(400).json({ error: "Invalid table name." });
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    return response.status(503).json({
      error: "Table metadata is unavailable. Configure SUPABASE_URL and SUPABASE_SECRET_KEY in .env."
    });
  }

  try {
    const schemaResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        accept: "application/openapi+json"
      }
    });

    if (!schemaResponse.ok) {
      return response.status(502).json({
        error: "Could not read the Supabase schema.",
        supabaseStatus: schemaResponse.status
      });
    }

    const document = await schemaResponse.json() as OpenApiDocument;
    const tablePath = document.paths?.[`/${tableName}`];
    if (!tablePath) {
      return response.status(404).json({ error: `Table ${tableName} is not exposed by the Supabase Data API.` });
    }

    const getOperation = tablePath.get as {
      responses?: Record<string, { schema?: OpenApiSchema; content?: Record<string, { schema?: OpenApiSchema }> }>;
    } | undefined;
    const successResponse = getOperation?.responses?.["200"]
      ?? Object.entries(getOperation?.responses ?? {}).find(([status]) => status.startsWith("2"))?.[1];
    let tableSchema = successResponse?.schema
      ?? Object.values(successResponse?.content ?? {})[0]?.schema
      ?? {};
    tableSchema = resolveSchema(tableSchema, document);
    if (tableSchema.type === "array" && tableSchema.items) {
      tableSchema = resolveSchema(tableSchema.items, document);
    }

    if (!tableSchema.properties) {
      return response.status(502).json({ error: "Supabase returned the table but no column schema was found." });
    }

    const columns = Object.entries(tableSchema.properties).map(([name, property]) => {
      const resolved = resolveSchema(property, document);
      const dataType = resolved.format
        ?? (resolved.type === "array" && resolved.items
          ? `${resolveSchema(resolved.items, document).format ?? resolveSchema(resolved.items, document).type ?? "unknown"}[]`
          : resolved.type)
        ?? "unknown";

      return { name, dataType, nullable: resolved.nullable ?? null };
    });

    return response.json({ table: tableName, columns });
  } catch {
    return response.status(502).json({ error: "Failed to connect to Supabase while reading table metadata." });
  }
});

export default router;
