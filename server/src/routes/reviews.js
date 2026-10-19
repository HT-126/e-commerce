import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { listReviewsSchema, createReviewSchema } from "../schemas/reviews.js";
import * as ctrl from "../controllers/reviewController.js";

const router = Router();

router.get("/:handle/reviews", validate(listReviewsSchema), ctrl.list);

// requireAuth is on THIS route only, because the list above must stay public.
router.post(
  "/:handle/reviews",
  requireAuth,
  validate(createReviewSchema),
  ctrl.create,
);

export default router;
