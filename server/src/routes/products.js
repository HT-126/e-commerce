import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { listProductsSchema } from "../schemas/productQuery.js";
import { productDetailSchema } from "../schemas/productDetail.js";
import * as ctrl from "../controllers/productController.js";

const router = Router();

router.get("/", validate(listProductsSchema), ctrl.list);
router.get("/:handle", validate(productDetailSchema), ctrl.detail);

export default router;
