import type { RequestHandler } from "express";
import { parseOrThrow, throwNotFound } from "./shared";
import { uuidSchema } from "../validation/common";
import {
  createShippingFeeSchema,
  listShippingFeesSchema,
  updateShippingFeeSchema,
} from "../validation/shipping-fee";
import * as service from "../services/shipping-fee.service";

export const list: RequestHandler = async (request, response) => {
  const query = parseOrThrow(listShippingFeesSchema, request.query, "query parameters");
  const result = await service.listShippingFees(query);
  response.json({
    data: result.data,
    pagination: { limit: query.limit, offset: query.offset, total: result.total },
  });
};

export const get: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shipping fee ID");
  const record = await service.getShippingFee(id);
  if (!record) throwNotFound("Shipping fee");
  response.json({ data: record });
};

export const create: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createShippingFeeSchema, request.body, "shipping fee");
  response.status(201).json({ data: await service.createShippingFee(body) });
};

export const update: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shipping fee ID");
  const body = parseOrThrow(updateShippingFeeSchema, request.body, "shipping fee update");
  const record = await service.updateShippingFee(id, body);
  if (!record) throwNotFound("Shipping fee");
  response.json({ data: record });
};

export const remove: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id, "shipping fee ID");
  const record = await service.deleteShippingFee(id);
  if (!record) throwNotFound("Shipping fee");
  response.json({ data: record });
};
