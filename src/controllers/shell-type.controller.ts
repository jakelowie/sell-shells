import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import { createShellTypeSchema, listShellTypesSchema, updateShellTypeSchema } from "../validation/shell-type";
import * as service from "../services/shell-type.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShellTypesSchema, request.query, "query parameters");
  const result = await service.listShellTypes(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell type ID");
  const record = await service.getShellType(id);
  if (!record) throwNotFound("Shell type");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createShellTypeSchema, request.body, "shell type");
  response.status(201).json({ data: await service.createShellType(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell type ID");
  const body = parseOrThrow(updateShellTypeSchema, request.body, "shell type update");
  const record = await service.updateShellType(id, body);
  if (!record) throwNotFound("Shell type");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell type ID");
  const record = await service.deleteShellType(id);
  if (!record) throwNotFound("Shell type");
  response.json({ data: record });
};
