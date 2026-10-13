import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import { listShellStockTypesSchema, createShellStockTypeSchema, updateShellStockTypeSchema } from "../validation/shell-stock-type";
import * as service from "../services/shell-stock-type.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShellStockTypesSchema, request.query, "query parameters");
  const result = await service.listShellStockTypes(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "stock type ID");
  const record = await service.getShellStockType(id);
  if (!record) throwNotFound("Shell stock type");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createShellStockTypeSchema, request.body, "shell stock type");
  response.status(201).json({ data: await service.createShellStockType(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "stock type ID");
  const body = parseOrThrow(updateShellStockTypeSchema, request.body, "shell stock type update");
  const record = await service.updateShellStockType(id, body);
  if (!record) throwNotFound("Shell stock type");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "stock type ID");
  const record = await service.deleteShellStockType(id);
  if (!record) throwNotFound("Shell stock type");
  response.json({ data: record });
};
