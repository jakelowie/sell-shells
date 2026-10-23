import "./config/env";
import express from "express";
import shellsRouter from "./routes/shells";
import shellLocalitiesRouter from "./routes/shell-localities";
import shellStockTypesRouter from "./routes/shell-stock-types";
import shellTypesRouter from "./routes/shell-type";
import stockInfoRouter from "./routes/stock-info";
import shellImagesRouter from "./routes/shell-images";
import tableMetadataRouter from "./routes/table-metadata";
import { sendError } from "./controllers/shared";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import authRouter from "./routes/auth";
import shopRouter from "./routes/shop";
import adminOrdersRouter from "./routes/admin-orders";
import unitsRouter from "./routes/units";
import { authenticate, optionalAuthenticate, requireInventoryWriteRole, requireRole } from "./middleware/auth";

const app = express();
const openApiSpec = JSON.parse(readFileSync(path.resolve(__dirname, "../swagger.json"), "utf8"));

if (process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}

app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json());
app.get("/api-docs.json", (_request, response) => {
  response.json(openApiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { swaggerOptions: { validatorUrl: null } }));
app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/shop", shopRouter);
app.use("/api/admin/orders", authenticate, requireRole("admin", "superadmin"), adminOrdersRouter);
app.use("/api/units", authenticate, requireRole("admin", "superadmin"), unitsRouter);
app.use("/api/shells", optionalAuthenticate, requireInventoryWriteRole, shellsRouter);
app.use("/api/shell-localities", optionalAuthenticate, requireInventoryWriteRole, shellLocalitiesRouter);
app.use("/api/shell-stock-types", authenticate, requireRole("admin", "superadmin"), requireInventoryWriteRole, shellStockTypesRouter);
app.use("/api/shell-types", optionalAuthenticate, requireInventoryWriteRole, shellTypesRouter);
app.use("/api/stock-info", authenticate, requireRole("admin", "superadmin"), requireInventoryWriteRole, stockInfoRouter);
app.use("/api/shell-stocks-info", authenticate, requireRole("admin", "superadmin"), requireInventoryWriteRole, stockInfoRouter);
app.use("/api/shell-images", optionalAuthenticate, requireInventoryWriteRole, shellImagesRouter);
app.use("/api/table", authenticate, requireRole("superadmin"), tableMetadataRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    response.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "Image exceeds the 5 MB upload limit." : "Invalid image upload. Upload one image file."
    });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({ error: "Image exceeds the 5 MB upload limit." });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }
  sendError(response, error);
});

export default app;
