import { Router } from "express";
import {
  getAdminPendingPropertiesController,
  getAdminPendingPropertyController,
  decideAdminPropertyController,
  exportAdminPropertiesController,
  listAdminPropertiesController
} from "../controllers/propertyController";

import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

// All properties — every status
router.get("/all/export", exportAdminPropertiesController);
router.get("/all", listAdminPropertiesController);


router.get("/", getAdminPendingPropertiesController);//retrieve all pending properties
router.get("/:propertyId", getAdminPendingPropertyController);//get single property
router.patch("/:propertyId/decision", decideAdminPropertyController);//approve or reject property

export default router;