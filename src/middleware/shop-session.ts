import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { getSupabaseCommerceClient } from "../config/supabase";
import { throwDatabaseError } from "../errors/database-error";
import { ApiError } from "../errors/api-error";
import { shopTokenSchema } from "../validation/shop";

/** Resolves the guest capability token without ever storing or logging its raw value. */
export const requireShopSession: RequestHandler = async (request, _response, next) => {
  try {
    const token = shopTokenSchema.safeParse(request.get("X-Shop-Token")?.trim());
    if (!token.success) throw new ApiError(401, "A valid shop session token is required.");

    const tokenHash = createHash("sha256").update(token.data).digest("hex");
    const { data, error } = await getSupabaseCommerceClient()
      .from("shop_sessions")
      .select("session_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    throwDatabaseError(error);
    if (!data) throw new ApiError(401, "Shop session is invalid. Start a new shopping session.");

    request.shopSessionId = data.session_id;
    next();
  } catch (error) {
    next(error);
  }
};
