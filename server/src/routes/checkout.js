import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/checkoutController.js";

const router = Router();
router.use(requireAuth);

router.post("/", ctrl.create);

export default router;
