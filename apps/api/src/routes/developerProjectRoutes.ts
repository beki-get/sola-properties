import { Router } from "express";
import {
  createProjectController,
  getMyProjectController,
  getMyProjectsController,
  updateProjectController,
  updateProjectStatusController,
  getDeveloperProjectPropertiesController,
} from "../controllers/projectController";
import { authenticate } from "../middlewares/authenticate";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, authorizeRoles("developer"), requireApprovedAccount);

router.post("/", createProjectController);
router.get("/", getMyProjectsController);
router.get("/:projectid/properties", getDeveloperProjectPropertiesController);

router.get("/:projectid", getMyProjectController);
router.patch("/:projectid", updateProjectController);
router.patch("/:projectid/status", updateProjectStatusController);

export default router;
