import { Router } from "express";
import { optionalShopSession, requireShopSession } from "../middleware/shop-session";
import * as controller from "../controllers/customer-features.controller";
import multer from "multer";
import { validateImageUpload } from "../middleware/image-upload";

const router = Router();
router.post("/contact", optionalShopSession, controller.createInquiry);
router.get("/shipping", controller.shippingOptions);
router.get("/settings", controller.publicSettings);
router.use(requireShopSession);
router.post("/discounts/validate", controller.validateDiscount);
router.post("/feedback", controller.createFeedback);
router.get("/feedback", controller.listFeedback);
router.post("/returns", controller.createReturn);
router.get("/returns", controller.listReturns);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
});
router.post(
  "/returns/:returnId/evidence",
  upload.single("image"),
  validateImageUpload,
  controller.uploadReturnEvidence,
);
router.get("/returns/:returnId/evidence", controller.listCustomerEvidence);
router.post("/invoices", controller.requestInvoice);
router.get("/invoices", controller.listInvoices);
export default router;
