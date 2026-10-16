import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import { createShellLocalitySchema, listShellLocalitiesSchema, updateShellLocalitySchema } from "../validation/shell-locality";
import * as service from "../services/shell-locality.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShellLocalitiesSchema, request.query, "query parameters");
  const result = await service.listShellLocalities(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "locality ID");
  const record = await service.getShellLocality(id);
  if (!record) throwNotFound("Shell locality");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createShellLocalitySchema, request.body, "shell locality");
  response.status(201).json({ data: await service.createShellLocality(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "locality ID");
  const body = parseOrThrow(updateShellLocalitySchema, request.body, "shell locality update");
  const record = await service.updateShellLocality(id, body);
  if (!record) throwNotFound("Shell locality");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "locality ID");
  const record = await service.deleteShellLocality(id);
  if (!record) throwNotFound("Shell locality");
  response.json({ data: record });
};
