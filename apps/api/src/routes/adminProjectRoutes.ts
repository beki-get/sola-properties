import { Router } from "express";
import {
  getAllProjectsAdminController,
  getProjectAdminController,
} from "../controllers/adminProjectController";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", getAllProjectsAdminController);
router.get("/:projectid", getProjectAdminController);

export default router;