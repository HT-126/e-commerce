import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { orderIdSchema, listOrdersSchema } from "../schemas/orders.js";
import * as ctrl from "../controllers/orderController.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listOrdersSchema), ctrl.list);
router.get("/:id", validate(orderIdSchema), ctrl.detail);

export default router;
