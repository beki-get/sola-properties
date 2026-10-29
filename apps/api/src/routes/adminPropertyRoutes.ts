import { Router } from "express";
import {
  getAdminPendingPropertiesController,
  getAdminPendingPropertyController,
  decideAdminPropertyController,
} from "../controllers/propertyController";

import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", getAdminPendingPropertiesController);
router.get("/:propertyId", getAdminPendingPropertyController);
router.patch("/:propertyId/decision", decideAdminPropertyController);

export default router;