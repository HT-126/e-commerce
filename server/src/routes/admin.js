import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  adminOrdersSchema,
  adminStatsSchema,
  adminVariantsSchema,
  updateVariantSchema,
  adminReviewsSchema,
  deleteReviewSchema,
  createProductSchema,
  deleteProductSchema,
} from "../schemas/admin.js";
import * as ctrl from "../controllers/adminController.js";

// requireAuth and requireAdmin are added in app.js, once for ALL admin routes
const router = Router();

router.get("/stats", validate(adminStatsSchema), ctrl.stats);
router.get("/orders", validate(adminOrdersSchema), ctrl.orders);
router.get("/variants", validate(adminVariantsSchema), ctrl.variants);
router.patch("/variants/:id", validate(updateVariantSchema), ctrl.updateVariant);
router.post("/products", validate(createProductSchema), ctrl.createProduct);
router.delete("/products/:id", validate(deleteProductSchema), ctrl.deleteProduct);
router.get("/reviews", validate(adminReviewsSchema), ctrl.reviews);
router.delete("/reviews/:id", validate(deleteReviewSchema), ctrl.deleteReview);

export default router;
