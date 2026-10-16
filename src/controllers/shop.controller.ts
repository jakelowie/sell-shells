import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error";
import { parseOrThrow } from "./shared";
import { pageQuerySchema, uuidSchema } from "../validation/common";
import { availabilityQuerySchema, cartItemSchema, createOrderSchema } from "../validation/shop";
import * as service from "../services/shop.service";

export const config: RequestHandler = (_request, response) => {
  response.json({ data: service.getShopConfig() });
};

export const createSession: RequestHandler = async (_request, response) => {
  response.status(201).json({ data: await service.createGuestSession() });
};

export const availability: RequestHandler = async (request, response) => {
  const query = parseOrThrow(availabilityQuerySchema, request.query, "availability query");
  response.json({ data: await service.getAvailability([...new Set(query.ids)]) });
};

export const getCart: RequestHandler = async (request, response) => {
  response.json({ data: await service.getCart(requireSessionId(request)) });
};

export const addCartItem: RequestHandler = async (request, response) => {
  const body = parseOrThrow(cartItemSchema, request.body, "cart item");
  response.status(201).json({ data: await service.addCartItem(requireSessionId(request), body.shell_id, body.quantity) });
};

export const updateCartItem: RequestHandler = async (request, response) => {
  const shellId = parseOrThrow(uuidSchema, request.params.shellId, "shell ID");
  const quantityBody = parseOrThrow(cartItemSchema.omit({ shell_id: true }), request.body, "cart quantity");
  response.json({ data: await service.setCartItem(requireSessionId(request), shellId, quantityBody.quantity) });
};

export const removeCartItem: RequestHandler = async (request, response) => {
  const shellId = parseOrThrow(uuidSchema, request.params.shellId, "shell ID");
  response.json({ data: await service.removeCartItem(requireSessionId(request), shellId) });
};

export const createOrder: RequestHandler = async (request, response) => {
  const body = parseOrThrow(createOrderSchema, request.body, "checkout request");
  response.status(201).json({ data: await service.createOrder(requireSessionId(request), body) });
};

export const captureOrder: RequestHandler = async (request, response) => {
  const orderId = parseOrThrow(uuidSchema, request.params.orderId, "order ID");
  response.json({ data: await service.captureOrder(requireSessionId(request), orderId) });
};

export const listOrders: RequestHandler = async (request, response) => {
  const query = parseOrThrow(pageQuerySchema, request.query, "order query");
  response.json(await service.listOwnedOrders(requireSessionId(request), query.limit, query.offset));
};

export const getOrder: RequestHandler = async (request, response) => {
  const orderId = parseOrThrow(uuidSchema, request.params.orderId, "order ID");
  response.json({ data: await service.getOwnedOrder(requireSessionId(request), orderId) });
};

export const paypalWebhook: RequestHandler = async (request, response) => {
  await service.processPayPalWebhook({
    "paypal-auth-algo": request.get("paypal-auth-algo"),
    "paypal-cert-url": request.get("paypal-cert-url"),
    "paypal-transmission-id": request.get("paypal-transmission-id"),
    "paypal-transmission-sig": request.get("paypal-transmission-sig"),
    "paypal-transmission-time": request.get("paypal-transmission-time")
  }, request.body);
  response.status(200).json({ received: true });
};

function requireSessionId(request: Express.Request): string {
  if (!request.shopSessionId) throw new ApiError(401, "A valid shop session is required.");
  return request.shopSessionId;
}
