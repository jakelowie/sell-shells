import { Router } from "express";
import * as controller from "../controllers/shop.controller";
import { requireShopSession } from "../middleware/shop-session";

const router = Router();

router.get("/config", controller.config);
router.post("/sessions", controller.createSession);
router.post("/paypal/webhook", controller.paypalWebhook);
router.get("/availability", controller.availability);

router.use(requireShopSession);
router.get("/cart", controller.getCart);
router.post("/cart/items", controller.addCartItem);
router.put("/cart/items/:shellId", controller.updateCartItem);
router.delete("/cart/items/:shellId", controller.removeCartItem);
router.get("/orders", controller.listOrders);
router.post("/orders", controller.createOrder);
router.post("/orders/:orderId/capture", controller.captureOrder);
router.get("/orders/:orderId", controller.getOrder);

export default router;
