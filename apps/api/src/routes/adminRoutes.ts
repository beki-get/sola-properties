import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  createAdminUserController,
  getAuditLogsController,
  getUserByIdController,
  getUsersController,
  updateUserStatusController,
  createPropertyCategoryController,
  updatePropertyCategoryController,
  createPropertyLocationController,
  updatePropertyLocationController,
  exportUsersController,
} from "../controllers/adminController";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/audit-logs", getAuditLogsController);
router.get("/users", getUsersController);
router.get("/users/export", exportUsersController);
router.get("/users/:id", getUserByIdController);
router.post("/users", createAdminUserController);
router.patch("/users/:id/status", updateUserStatusController);
router.post("/properties/categories", createPropertyCategoryController);
router.patch("/properties/categories/:id", updatePropertyCategoryController);
router.post("/properties/locations", createPropertyLocationController);
router.patch("/properties/locations/:id", updatePropertyLocationController);

export default router;
