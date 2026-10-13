import { Router } from "express";
import * as controller from "../controllers/shell-stock-type.controller";

const router = Router();
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", controller.create);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
