import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import { listShellDescriptionsSchema, createShellDescriptionSchema, updateShellDescriptionSchema } from "../validation/shell-description";
import * as service from "../services/shell-description.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShellDescriptionsSchema, request.query, "query parameters");
  const result = await service.listShellDescriptions(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell ID");
  const record = await service.getShellDescription(id);
  if (!record) throwNotFound("Shell description");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createShellDescriptionSchema, request.body, "shell description");
  response.status(201).json({ data: await service.createShellDescription(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell ID");
  const body = parseOrThrow(updateShellDescriptionSchema, request.body, "shell description update");
  const record = await service.updateShellDescription(id, body);
  if (!record) throwNotFound("Shell description");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell ID");
  const record = await service.deleteShellDescription(id);
  if (!record) throwNotFound("Shell description");
  response.json({ data: record });
};
