import type { RequestHandler } from "express";
import { z } from "zod";
import { ApiError } from "../errors/api-error";
import { parseOrThrow } from "./shared";
import { uuidSchema } from "../validation/common";
import type { AppRole } from "../models/database";
import * as service from "../services/auth.service";

const roleBodySchema = z.object({ role: z.enum(["user", "admin", "superadmin"]) }).strict();

export const me: RequestHandler = (request, response, next) => {
  if (!request.authUser || !request.authRole) {
    next(new ApiError(401, "Sign in to access this resource."));
    return;
  }
  response.json({ data: { ...request.authUser, role: request.authRole } });
};

export const listUsers: RequestHandler = async (_request, response) => {
  response.json({ data: await service.listUserRoles() });
};

export const updateUserRole: RequestHandler = async (request, response) => {
  const userId = parseOrThrow(uuidSchema, request.params.userId, "user ID");
  const body = parseOrThrow(roleBodySchema, request.body, "role assignment");
  const role: AppRole = body.role;
  const record = await service.assignUserRole(userId, role);
  if (!record) throw new ApiError(409, "The role assignment could not be completed.");
  response.json({ data: record });
};
