import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  addToCartSchema,
  updateCartSchema,
  removeFromCartSchema,
} from "../schemas/cart.js";
import * as ctrl from "../controllers/cartController.js";

const router = Router();

// Every cart route needs a logged-in user, so we put it once at the top.
router.use(requireAuth);

router.get("/", ctrl.get);
router.post("/", validate(addToCartSchema), ctrl.add);
router.patch("/:variantId", validate(updateCartSchema), ctrl.update);
router.delete("/:variantId", validate(removeFromCartSchema), ctrl.remove);

export default router;
