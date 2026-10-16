import { Router } from "express";
import * as controller from "../controllers/auth.controller";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();
router.get("/me", authenticate, controller.me);
router.get("/users", authenticate, requireRole("superadmin"), controller.listUsers);
router.patch("/users/:userId/role", authenticate, requireRole("superadmin"), controller.updateUserRole);

export default router;
