import { Router } from "express";
import * as controller from "../controllers/admin-orders.controller";

const router = Router();
router.get("/", controller.listOrders);
router.get("/:orderId", controller.getOrder);

export default router;
