import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema, registerSchema } from "../schemas/auth.js";
import {
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
} from "../middleware/rateLimit.js";
import * as ctrl from "../controllers/authController.js";

const router = Router();

router.post("/register", registerLimiter, validate(registerSchema), ctrl.register);
router.post(
  "/login",
  loginLimiter,
  loginAccountLimiter,
  validate(loginSchema),
  ctrl.login,
);
router.get("/me", requireAuth, ctrl.me);
router.post("/logout", ctrl.logout);

export default router;
