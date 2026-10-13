import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/shell-images.controller";
import { validateImageUpload } from "../middleware/image-upload";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 128, parts: 3 }
});
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", upload.single("image"), validateImageUpload, controller.create);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
