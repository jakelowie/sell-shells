import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { getSupabaseCommerceClient } from "../config/supabase";
import { ApiError } from "../errors/api-error";
import { throwDatabaseError } from "../errors/database-error";
import * as evidenceService from "../services/return-evidence.service";
import { uuidSchema } from "../validation/common";
import { parseOrThrow } from "./shared";

const db = () => getSupabaseCommerceClient() as any;

const pageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const orderForm = z
  .object({
    order_id: z.string().uuid(),
    feedback_message: z.string().trim().min(1).max(5000),
  })
  .strict();

const inquiryForm = z
  .object({
    customer_name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    order_id: z.string().uuid().optional(),
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(1).max(5000),
  })
  .strict();

const returnForm = z
  .object({
    order_id: z.string().uuid(),
    reason: z.string().trim().min(2).max(160),
    details: z.string().trim().min(1).max(5000),
    requested_resolution: z.enum(["refund", "replacement", "other"]).default("refund"),
  })
  .strict();

const discountForm = z
  .object({
    code: z.string().trim().min(3).max(40),
    subtotal: z.number().finite().nonnegative(),
  })
  .strict();

const session = (request: Request) => {
  if (!request.shopSessionId) {
    throw new ApiError(401, "A valid shop session is required.");
  }

  return request.shopSessionId;
};

export const createFeedback: RequestHandler = async (req, res) => {
  const body = parseOrThrow(orderForm, req.body, "feedback");
  const owner = session(req);
  const { data: order, error: orderError } = await db()
    .from("shop_orders")
    .select("order_id")
    .eq("order_id", body.order_id)
    .eq("session_id", owner)
    .maybeSingle();

  throwDatabaseError(orderError);
  if (!order) throw new ApiError(404, "Order was not found in this shopping session.");

  const { data, error } = await db()
    .from("shop_feedback")
    .insert({
      order_id: body.order_id,
      session_id: owner,
      feedback_message: body.feedback_message,
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    throw new ApiError(409, "Feedback has already been submitted for this order.");
  }

  throwDatabaseError(error);
  res.status(201).json({ data });
};

export const listFeedback: RequestHandler = async (req, res) => {
  const queryParams = parseOrThrow(pageSchema, req.query, "pagination");
  const owner = session(req);
  const { data, error, count } = await db()
    .from("shop_feedback")
    .select("feedback_id,order_id,feedback_message,created_at", { count: "exact" })
    .eq("session_id", owner)
    .order("created_at", { ascending: false })
    .range(queryParams.offset, queryParams.offset + queryParams.limit - 1);

  throwDatabaseError(error);
  res.json({ data: data ?? [], pagination: { ...queryParams, total: count ?? 0 } });
};

export const createInquiry: RequestHandler = async (req, res) => {
  const body = parseOrThrow(inquiryForm, req.body, "contact inquiry");
  const orderId = body.order_id ?? null;

  if (orderId && req.shopSessionId) {
    const { data, error } = await db()
      .from("shop_orders")
      .select("order_id")
      .eq("order_id", orderId)
      .eq("session_id", req.shopSessionId)
      .maybeSingle();

    throwDatabaseError(error);
    if (!data) throw new ApiError(404, "Related order was not found.");
  } else if (orderId) {
    throw new ApiError(401, "Start a shopping session to attach an order.");
  }

  const { data, error } = await db()
    .from("shop_contact_inquiries")
    .insert({ ...body, session_id: req.shopSessionId ?? null, order_id: orderId })
    .select("inquiry_id,status,created_at")
    .single();

  throwDatabaseError(error);
  res.status(201).json({ data });
};

export const createReturn: RequestHandler = async (req, res) => {
  const body = parseOrThrow(returnForm, req.body, "return request");
  const owner = session(req);
  const { data: order, error: orderError } = await db()
    .from("shop_orders")
    .select("order_id,payment_status,created_at")
    .eq("order_id", body.order_id)
    .eq("session_id", owner)
    .maybeSingle();

  throwDatabaseError(orderError);
  if (!order) throw new ApiError(404, "Order was not found in this shopping session.");
  if (order.payment_status !== "captured") {
    throw new ApiError(409, "Only paid orders can be submitted for return review.");
  }

  const { data: settings, error: settingsError } = await db()
    .from("shop_store_settings")
    .select("return_policy")
    .eq("singleton", true)
    .single();

  throwDatabaseError(settingsError);
  const policy = settings?.return_policy as
    { enabled?: boolean; window_days?: number | null } | undefined;
  if (!policy?.enabled || !Number.isInteger(policy.window_days) || Number(policy.window_days) < 1) {
    throw new ApiError(
      503,
      "Return requests are not available until the store configures its return policy.",
    );
  }
  if (Date.now() > Date.parse(order.created_at) + Number(policy.window_days) * 86400000) {
    throw new ApiError(409, "This order is outside the configured return request period.");
  }

  const { data: existing, error: existingError } = await db()
    .from("shop_return_requests")
    .select("return_id")
    .eq("order_id", body.order_id)
    .maybeSingle();

  throwDatabaseError(existingError);
  if (existing) throw new ApiError(409, "A return request already exists for this order.");

  const { data, error } = await db()
    .from("shop_return_requests")
    .insert({ ...body, session_id: owner })
    .select("*")
    .single();

  if (error?.code === "23505") {
    throw new ApiError(409, "A return request already exists for this order.");
  }

  throwDatabaseError(error);
  res.status(201).json({ data });
};

export const listReturns: RequestHandler = async (req, res) => {
  const queryParams = parseOrThrow(pageSchema, req.query, "pagination");
  const owner = session(req);
  const { data, error, count } = await db()
    .from("shop_return_requests")
    .select("return_id,order_id,reason,details,requested_resolution,status,created_at,updated_at", {
      count: "exact",
    })
    .eq("session_id", owner)
    .order("created_at", { ascending: false })
    .range(queryParams.offset, queryParams.offset + queryParams.limit - 1);

  throwDatabaseError(error);
  res.json({ data: data ?? [], pagination: { ...queryParams, total: count ?? 0 } });
};

export const uploadReturnEvidence: RequestHandler = async (req, res) => {
  const returnId = parseOrThrow(uuidSchema, req.params.returnId, "return request ID");
  if (!req.uploadedImage) throw new ApiError(400, "Upload one evidence image.");

  const data = await evidenceService.uploadReturnEvidence(
    returnId,
    session(req),
    req.uploadedImage,
  );
  res.status(201).json({ data });
};

export const listCustomerEvidence: RequestHandler = async (req, res) => {
  const returnId = parseOrThrow(uuidSchema, req.params.returnId, "return request ID");
  const owner = session(req);
  const { data, error } = await db()
    .from("shop_return_requests")
    .select("return_id")
    .eq("return_id", returnId)
    .eq("session_id", owner)
    .maybeSingle();

  throwDatabaseError(error);
  if (!data) throw new ApiError(404, "Return request not found.");

  res.json({ data: await evidenceService.listReturnEvidence(returnId, owner) });
};

export const requestInvoice: RequestHandler = async (req, res) => {
  const body = parseOrThrow(
    z.object({ order_id: z.string().uuid() }).strict(),
    req.body,
    "invoice request",
  );
  const owner = session(req);
  const { data: order, error: orderError } = await db()
    .from("shop_orders")
    .select("order_id,payment_status")
    .eq("order_id", body.order_id)
    .eq("session_id", owner)
    .maybeSingle();

  throwDatabaseError(orderError);
  if (!order) throw new ApiError(404, "Order was not found in this shopping session.");

  const { data, error } = await db()
    .from("shop_invoices")
    .upsert(
      { order_id: body.order_id, session_id: owner },
      { onConflict: "order_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();

  throwDatabaseError(error);
  if (data) {
    res.status(201).json({ data });
    return;
  }

  const { data: existing, error: readError } = await db()
    .from("shop_invoices")
    .select("invoice_id,invoice_number,status,snapshot,created_at,updated_at")
    .eq("order_id", body.order_id)
    .eq("session_id", owner)
    .single();

  throwDatabaseError(readError);
  res.json({ data: existing });
};

export const listInvoices: RequestHandler = async (req, res) => {
  const owner = session(req);
  const { data, error } = await db()
    .from("shop_invoices")
    .select("invoice_id,invoice_number,order_id,status,snapshot,created_at,updated_at")
    .eq("session_id", owner)
    .order("created_at", { ascending: false });

  throwDatabaseError(error);
  res.json({ data: data ?? [] });
};

export const shippingOptions: RequestHandler = async (req, res) => {
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : null;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw new ApiError(400, "Enter a two-letter destination country code.");
  }

  let query = db()
    .from("shop_shipping_rates")
    .select(
      "rate_id,country_code,currency,amount,min_days,max_days,starts_at,expires_at,service:shop_shipping_services!inner(service_id,name,active,courier:shop_shipping_couriers!inner(courier_id,name,active))",
    )
    .eq("active", true)
    .eq("service.active", true)
    .eq("service.courier.active", true);

  if (country) query = query.eq("country_code", country);

  const { data, error } = await query;
  throwDatabaseError(error);

  const now = Date.now();
  const availableRates = (data ?? []).filter(
    (rate: any) =>
      (!rate.starts_at || Date.parse(rate.starts_at) <= now) &&
      (!rate.expires_at || Date.parse(rate.expires_at) > now),
  );

  res.json({ data: availableRates });
};

export const publicSettings: RequestHandler = async (_req, res) => {
  const { data, error } = await db()
    .from("shop_store_settings")
    .select("business_contact,payment_information,return_policy")
    .eq("singleton", true)
    .single();

  throwDatabaseError(error);
  res.json({
    data: data ?? {
      business_contact: {},
      payment_information: {},
      return_policy: { enabled: false },
    },
  });
};

export const validateDiscount: RequestHandler = async (req, res) => {
  const body = parseOrThrow(discountForm, req.body, "discount");
  const code = body.code.toUpperCase();
  const owner = session(req);
  const { data, error } = await db()
    .from("shop_discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  throwDatabaseError(error);
  const now = Date.now();
  if (!data) throw new ApiError(400, "Discount code was not found.");
  if (!data.active) throw new ApiError(400, "This discount code is inactive.");
  if (data.starts_at && Date.parse(data.starts_at) > now) {
    throw new ApiError(400, "This discount code is not active yet.");
  }
  if (data.expires_at && Date.parse(data.expires_at) <= now) {
    throw new ApiError(400, "This discount code has expired.");
  }
  if (data.usage_limit !== null && data.usage_count >= data.usage_limit) {
    throw new ApiError(400, "This discount code has reached its total redemption limit.");
  }
  if (body.subtotal < data.minimum_subtotal) {
    throw new ApiError(
      400,
      `Add at least ${Number(data.minimum_subtotal).toFixed(2)} to your order to use this discount code.`,
    );
  }

  if (data.per_customer_limit === 0) {
    throw new ApiError(
      400,
      "This discount code has a per-session limit of 0. Set a positive limit or clear the limit to allow redemptions.",
    );
  }

  if (data.per_customer_limit != null) {
    const { count, error: usageError } = await db()
      .from("shop_discount_usages")
      .select("usage_id", { count: "exact", head: true })
      .eq("discount_id", data.discount_id)
      .eq("session_id", owner);

    throwDatabaseError(usageError);
    if ((count ?? 0) >= data.per_customer_limit) {
      throw new ApiError(400, "You have reached the redemption limit for this discount code.");
    }
  }

  const discountAmount = Math.min(
    data.discount_type === "percentage"
      ? (body.subtotal * Number(data.discount_value)) / 100
      : Number(data.discount_value),
    data.maximum_discount == null ? Infinity : Number(data.maximum_discount),
    body.subtotal,
  );

  res.json({
    data: {
      code: data.code,
      discount_amount: Number(discountAmount.toFixed(2)),
      subtotal: body.subtotal,
      eligible_subtotal: Number((body.subtotal - discountAmount).toFixed(2)),
    },
  });
};
