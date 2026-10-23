import { Router } from "express";
import { parseOrThrow, throwNotFound } from "../controllers/shared";
import { uuidSchema } from "../validation/common";
import { unitListQuerySchema, unitSchema, unitUpdateSchema } from "../validation/unit";
import * as service from "../services/units.service";

const router = Router();
router.get("/", async (request, response) => {
  const query = parseOrThrow(unitListQuerySchema, request.query, "unit query");
  const result = await service.listUnits(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
});
router.get("/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "unit ID");
  const data = await service.getUnit(id);
  if (!data) throwNotFound("Unit");
  response.json({ data });
});
router.post("/", async (request, response) => {
  const body = parseOrThrow(unitSchema.omit({ id: true }), request.body, "unit");
  response.status(201).json({ data: await service.createUnit(body) });
});
router.patch("/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "unit ID");
  const body = parseOrThrow(unitUpdateSchema, request.body, "unit update");
  const data = await service.updateUnit(id, body);
  if (!data) throwNotFound("Unit");
  response.json({ data });
});
router.delete("/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "unit ID");
  const data = await service.deleteUnit(id);
  if (!data) throwNotFound("Unit");
  response.json({ data });
});
export default router;
