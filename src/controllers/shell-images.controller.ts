import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import { listShellImagesSchema, uploadShellImageSchema, updateShellImageSchema } from "../validation/shell-image";
import * as service from "../services/shell-images.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShellImagesSchema, request.query, "query parameters");
  const result = await service.listShellImages(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell image ID");
  const record = await service.getShellImage(id);
  if (!record) throwNotFound("Shell image");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(uploadShellImageSchema, request.body, "shell image upload");
  if (!request.uploadedImage) throw new Error("Validated image upload is missing.");
  response.status(201).json({ data: await service.createShellImage(body, request.uploadedImage) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell image ID");
  const body = parseOrThrow(updateShellImageSchema, request.body, "shell image update");
  const record = await service.updateShellImage(id, body);
  if (!record) throwNotFound("Shell image");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shell image ID");
  const record = await service.deleteShellImage(id);
  if (!record) throwNotFound("Shell image");
  response.json({ data: record });
};
