import type { RequestHandler } from "express";
import { parseOrThrow } from "./shared";
import { pageQuerySchema, uuidSchema } from "../validation/common";
import * as shopService from "../services/shop.service";

export const listOrders: RequestHandler = async (request, response) => {
  const query = parseOrThrow(pageQuerySchema, request.query, "order query");
  response.json(await shopService.listAdminOrders(query.limit, query.offset));
};

export const getOrder: RequestHandler = async (request, response) => {
  const orderId = parseOrThrow(uuidSchema, request.params.orderId, "order ID");
  response.json({ data: await shopService.getAdminOrder(orderId) });
};
