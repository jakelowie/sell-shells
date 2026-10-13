import type { RequestHandler } from "express";
import { z } from "zod";
import { parseOrThrow, throwNotFound } from "./shared";
import { listStockInfoSchema, createStockInfoSchema, updateStockInfoSchema } from "../validation/stock-info";
import * as service from "../services/stock-info.service";

const stockInfoIdSchema = z.string().regex(/^-?\d+$/).refine((value) => Number.isSafeInteger(Number(value))).transform(Number);

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listStockInfoSchema, request.query, "query parameters");
  const result = await service.listStockInfo(query);
  response.json({ data: result.data, pagination: { limit: query.limit, offset: query.offset, total: result.total } });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(stockInfoIdSchema, request.params.id, "stock info ID");
  const record = await service.getStockInfo(id);
  if (!record) throwNotFound("Stock info");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createStockInfoSchema, request.body, "stock info");
  response.status(201).json({ data: await service.createStockInfo(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(stockInfoIdSchema, request.params.id, "stock info ID");
  const body = parseOrThrow(updateStockInfoSchema, request.body, "stock info update");
  const record = await service.updateStockInfo(id, body);
  if (!record) throwNotFound("Stock info");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(stockInfoIdSchema, request.params.id, "stock info ID");
  const record = await service.deleteStockInfo(id);
  if (!record) throwNotFound("Stock info");
  response.json({ data: record });
};
