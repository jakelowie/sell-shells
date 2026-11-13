import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { getSupabaseCommerceClient } from "../config/supabase";
import { ApiError } from "../errors/api-error";
import { throwDatabaseError } from "../errors/database-error";
import * as evidenceService from "../services/return-evidence.service";
import { uuidSchema } from "../validation/common";
import { parseOrThrow } from "./shared";

const db = () => getSupabaseCommerceClient() as any;

const id = (req: Request) => parseOrThrow(uuidSchema, req.params.id, "record ID");

const paging = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const getPage = async (
  res: any,
  table: string,
  columns: string,
  req: Request,
  order = "created_at",
) => {
  const page = parseOrThrow(paging, req.query, "pagination");
  const { data, error, count } = await db()
    .from(table)
    .select(columns, { count: "exact" })
    .order(order, { ascending: false })
    .range(page.offset, page.offset + page.limit - 1);

  throwDatabaseError(error);
  res.json({ data: data ?? [], pagination: { ...page, total: count ?? 0 } });
};

const returnStatuses = [
  "pending",
  "under_review",
  "additional_information_required",
  "approved",
  "rejected",
  "return_in_progress",
  "returned",
  "refund_processing",
  "refunded",
  "closed",
] as const;

export const feedback: RequestHandler = async (req, res) =>
  getPage(res, "shop_feedback", "feedback_id,order_id,session_id,feedback_message,created_at", req);

export const inquiries: RequestHandler = async (req, res) =>
  getPage(res, "shop_contact_inquiries", "*", req);

export const returns: RequestHandler = async (req, res) =>
  getPage(res, "shop_return_requests", "*", req);

export const updateReturn: RequestHandler = async (req, res) => {
  const schema = z
    .object({
      status: z.enum(returnStatuses),
      admin_remarks: z.string().trim().max(2000).nullable().optional(),
    })
    .strict();
  const body = parseOrThrow(schema, req.body, "return update");
  const { data, error } = await db().rpc("shop_update_return_status", {
    p_return_id: id(req),
    p_new_status: body.status,
    p_changed_by: req.authUser!.id,
    p_remarks: body.admin_remarks ?? null,
  });

  if (error?.message?.includes("return_not_found")) {
    throw new ApiError(404, "Return request not found.");
  }
  if (error?.message?.includes("invalid_return_transition")) {
    throw new ApiError(409, "This return status transition is not allowed.");
  }

  throwDatabaseError(error);
  res.json({ data });
};

export const returnHistory: RequestHandler = async (req, res) => {
  const { data, error } = await db()
    .from("shop_return_history")
    .select("*")
    .eq("return_id", id(req))
    .order("created_at", { ascending: false });

  throwDatabaseError(error);
  res.json({ data: data ?? [] });
};

export const returnEvidence: RequestHandler = async (req, res) => {
  const returnId = id(req);
  const { data, error } = await db()
    .from("shop_return_requests")
    .select("return_id")
    .eq("return_id", returnId)
    .maybeSingle();

  throwDatabaseError(error);
  if (!data) throw new ApiError(404, "Return request not found.");

  res.json({ data: await evidenceService.listReturnEvidence(returnId) });
};

export const invoices: RequestHandler = async (req, res) => getPage(res, "shop_invoices", "*", req);

export const updateInvoice: RequestHandler = async (req, res) => {
  const schema = z
    .object({
      status: z.enum(["under_review", "approved", "rejected", "cancelled"]),
    })
    .strict();
  const body = parseOrThrow(schema, req.body, "invoice update");
  const { data, error } = await db()
    .from("shop_invoices")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("invoice_id", id(req))
    .select("*")
    .single();

  throwDatabaseError(error);
  res.json({ data });
};

export const generateInvoice: RequestHandler = async (req, res) => {
  const invoiceId = id(req);
  const { data: invoice, error: invoiceError } = await db()
    .from("shop_invoices")
    .select("invoice_id,order_id,status")
    .eq("invoice_id", invoiceId)
    .single();

  throwDatabaseError(invoiceError);
  if (!invoice) throw new ApiError(404, "Invoice request not found.");
  if (!["approved", "generated"].includes(invoice.status)) {
    throw new ApiError(409, "Approve the invoice request before generating it.");
  }

  const { data: order, error: orderError } = await db()
    .from("shop_orders")
    .select("*")
    .eq("order_id", invoice.order_id)
    .single();
  throwDatabaseError(orderError);

  const { data: items, error: itemsError } = await db()
    .from("shop_order_items")
    .select("shell_name,quantity,unit_price,line_total")
    .eq("order_id", invoice.order_id);
  throwDatabaseError(itemsError);

  const snapshot = { order, items: items ?? [], generated_at: new Date().toISOString() };
  const { data, error } = await db()
    .from("shop_invoices")
    .update({
      status: "generated",
      snapshot,
      generated_by: req.authUser?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoiceId)
    .select("*")
    .single();

  throwDatabaseError(error);
  res.json({ data });
};

export const updateOrderStatus: RequestHandler = async (req, res) => {
  const schema = z
    .object({
      status: z.enum(["preparing", "shipped", "delivered", "cancelled"]),
      remarks: z.string().trim().max(1000).optional(),
      courier_id: z.string().uuid().optional(),
      tracking_number: z.string().trim().max(200).optional(),
      estimated_delivery_at: z.string().datetime({ offset: true }).optional(),
    })
    .strict();
  const body = parseOrThrow(schema, req.body, "status update");
  const { data, error } = await db().rpc("shop_update_fulfillment_status", {
    p_order_id: id(req),
    p_new_status: body.status,
    p_changed_by: req.authUser!.id,
    p_remarks: body.remarks ?? null,
    p_courier_id: body.courier_id ?? null,
    p_tracking_number: body.tracking_number ?? null,
    p_estimated_delivery_at: body.estimated_delivery_at ?? null,
  });

  if (error?.message?.includes("order_not_found")) throw new ApiError(404, "Order not found.");
  if (error?.message?.includes("invalid_status_transition")) {
    throw new ApiError(409, "This fulfillment status transition is not allowed.");
  }
  if (error?.message?.includes("payment_required")) {
    throw new ApiError(409, "Only captured orders can be fulfilled.");
  }
  if (error?.message?.includes("shipping_details_required")) {
    throw new ApiError(400, "Courier and tracking number are required to mark an order shipped.");
  }

  throwDatabaseError(error);
  res.json({ data });
};

export const orderHistory: RequestHandler = async (req, res) => {
  const { data, error } = await db()
    .from("shop_order_status_history")
    .select("*")
    .eq("order_id", id(req))
    .order("created_at", { ascending: false });

  throwDatabaseError(error);
  res.json({ data: data ?? [] });
};

const discountSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(3).max(40),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z.number().positive().max(1000000),
    maximum_discount: z.number().positive().nullable().optional(),
    minimum_subtotal: z.number().nonnegative().default(0),
    per_customer_limit: z.number().int().positive().nullable().optional(),
    starts_at: z.string().datetime({ offset: true }).nullable().optional(),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    usage_limit: z.number().int().nonnegative().nullable().optional(),
    active: z.boolean().default(false),
  })
  .strict();

export const listDiscounts: RequestHandler = async (req, res) =>
  getPage(res, "shop_discount_codes", "*", req, "created_at");

export const createDiscount: RequestHandler = async (req, res) => {
  const body = parseOrThrow(discountSchema, req.body, "discount code");
  if (body.discount_type === "percentage" && body.discount_value > 100) {
    throw new ApiError(400, "Percentage discounts cannot exceed 100.");
  }

  const { data, error } = await db().from("shop_discount_codes").insert(body).select("*").single();

  throwDatabaseError(error);
  res.status(201).json({ data });
};

export const updateDiscount: RequestHandler = async (req, res) => {
  const body = parseOrThrow(discountSchema.partial().strict(), req.body, "discount update");
  const { data, error } = await db()
    .from("shop_discount_codes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("discount_id", id(req))
    .select("*")
    .single();

  throwDatabaseError(error);
  res.json({ data });
};

export const archiveDiscount: RequestHandler = async (req, res) => {
  const { data, error } = await db()
    .from("shop_discount_codes")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("discount_id", id(req))
    .select("discount_id,active")
    .single();

  throwDatabaseError(error);
  res.json({ data });
};

const courierSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).default(""),
    tracking_url_template: z.string().url().max(500).nullable().optional(),
    active: z.boolean().default(false),
  })
  .strict();

const serviceSchema = z
  .object({
    courier_id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    active: z.boolean().default(false),
  })
  .strict();

const rateFieldsSchema = z
  .object({
    service_id: z.string().uuid(),
    country_code: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
    amount: z.number().nonnegative(),
    min_days: z.number().int().nonnegative(),
    max_days: z.number().int().nonnegative(),
    active: z.boolean().default(false),
    starts_at: z.string().datetime({ offset: true }).nullable().optional(),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

const rateSchema = rateFieldsSchema.refine(
  (value) =>
    value.min_days === undefined ||
    value.max_days === undefined ||
    value.max_days >= value.min_days,
  "Maximum delivery days must be at least minimum delivery days.",
);

const listResource =
  (table: string): RequestHandler =>
  async (_req, res) => {
    const { data, error } = await db()
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    throwDatabaseError(error);
    res.json({ data: data ?? [] });
  };

const createResource =
  (table: string, schema: z.ZodTypeAny): RequestHandler =>
  async (req, res) => {
    const body = parseOrThrow(schema, req.body, table);
    const { data, error } = await db().from(table).insert(body).select("*").single();

    throwDatabaseError(error);
    res.status(201).json({ data });
  };

const updateResource =
  (table: string, key: string, schema: z.ZodObject<any>): RequestHandler =>
  async (req, res) => {
    const body: any = parseOrThrow(schema.partial().strict(), req.body, `${table} update`);
    const { data, error } = await db()
      .from(table)
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq(key, id(req))
      .select("*")
      .maybeSingle();

    throwDatabaseError(error);
    if (!data) {
      const resource = table.replace("shop_shipping_", "").replace(/s$/, "");
      const label = resource.charAt(0).toUpperCase() + resource.slice(1);
      throw new ApiError(404, `${label} not found.`);
    }

    res.json({ data });
  };

export const listCouriers = listResource("shop_shipping_couriers");
export const createCourier = createResource("shop_shipping_couriers", courierSchema);
export const updateCourier = updateResource("shop_shipping_couriers", "courier_id", courierSchema);

export const listServices = listResource("shop_shipping_services");
export const createService = createResource("shop_shipping_services", serviceSchema);
export const updateService = updateResource("shop_shipping_services", "service_id", serviceSchema);

export const listRates = listResource("shop_shipping_rates");
export const createRate = createResource("shop_shipping_rates", rateSchema);
export const updateRate = updateResource("shop_shipping_rates", "rate_id", rateFieldsSchema);

const settingsSchema = z
  .object({
    business_contact: z
      .object({
        email: z.string().email().max(254).nullable(),
        phone: z.string().trim().max(60).nullable(),
        address: z.string().trim().max(500).nullable(),
        hours: z.string().trim().max(500).nullable(),
      })
      .strict(),
    payment_information: z
      .object({
        methods: z.string().trim().max(1000).nullable(),
        instructions: z.string().trim().max(2000).nullable(),
        policy: z.string().trim().max(2000).nullable(),
      })
      .strict(),
    return_policy: z
      .object({
        enabled: z.boolean(),
        window_days: z.number().int().positive().nullable(),
        terms: z.string().trim().max(3000),
        evidence: z.string().trim().max(1000),
        shipping_responsibility: z.string().trim().max(1000),
        refund_information: z.string().trim().max(1000),
        non_returnable: z.string().trim().max(1000),
      })
      .strict(),
  })
  .strict();

export const adminSettings: RequestHandler = async (_req, res) => {
  const { data, error } = await db()
    .from("shop_store_settings")
    .select("*")
    .eq("singleton", true)
    .single();

  throwDatabaseError(error);
  res.json({ data });
};

export const updateSettings: RequestHandler = async (req, res) => {
  const body = parseOrThrow(settingsSchema, req.body, "store settings");
  const { data, error } = await db()
    .from("shop_store_settings")
    .update({ ...body, updated_by: req.authUser?.id, updated_at: new Date().toISOString() })
    .eq("singleton", true)
    .select("*")
    .single();

  throwDatabaseError(error);
  res.json({ data });
};
