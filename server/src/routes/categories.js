import { Router } from "express";
import * as ctrl from "../controllers/categoryController.js";

const router = Router();
router.get("/", ctrl.list);

export default router;
