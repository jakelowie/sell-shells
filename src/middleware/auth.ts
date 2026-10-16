import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error";
import type { AppRole } from "../models/database";
import { createUserSupabaseClient, getSupabaseClient, runWithUserSupabaseClient } from "../config/supabase";

const validRoles = new Set<AppRole>(["user", "admin", "superadmin"]);

/** Verifies the bearer token with Supabase and resolves the role from the protected role table. */
export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new ApiError(401, "Sign in to access this resource."));
    return;
  }

  try {
    const accessToken = match[1];
    const { data, error } = await getSupabaseClient().auth.getUser(accessToken);
    if (error || !data.user) {
      next(new ApiError(401, "Your session is invalid or has expired. Please sign in again."));
      return;
    }

    const userClient = createUserSupabaseClient(accessToken);
    const { data: roleRecord, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleError) {
      next(new ApiError(503, "Could not verify your account role. Try again later."));
      return;
    }
    if (!roleRecord || !validRoles.has(roleRecord.role)) {
      next(new ApiError(403, "Your account does not have a valid application role. Contact an administrator."));
      return;
    }

    request.authUser = { id: data.user.id, email: data.user.email ?? null };
    request.authRole = roleRecord.role;
    runWithUserSupabaseClient(userClient, next);
  } catch {
    next(new ApiError(503, "Authentication is temporarily unavailable. Try again later."));
  }
};

/** Allows public catalog reads while validating any supplied session token. */
export const optionalAuthenticate: RequestHandler = (request, response, next) => {
  if (!request.get("Authorization")) {
    next();
    return;
  }
  void authenticate(request, response, next);
};

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser || !request.authRole) {
      next(new ApiError(401, "Sign in to access this resource."));
      return;
    }
    if (!roles.includes(request.authRole)) {
      next(new ApiError(403, "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

/** Inventory reads are available to all roles; mutations require admin or superadmin. */
export const requireInventoryWriteRole: RequestHandler = (request, _response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    if (!request.authUser) {
      next(new ApiError(401, "Sign in to change inventory."));
      return;
    }
    if (request.authRole !== "admin" && request.authRole !== "superadmin") {
      next(new ApiError(403, "Only an admin or superadmin can change inventory."));
      return;
    }
  }
  next();
};
