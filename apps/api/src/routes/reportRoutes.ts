import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import {
  getAdminReportController,
  getAgentReportController,
  getDeveloperReportController,
  getFinanceAdminReportController,
} from "../controllers/reportController";

const router = Router();

router.use(authenticate, requireApprovedAccount);

router.get("/agent", authorizeRoles("agent"), getAgentReportController);

router.get(
  "/developer",
  authorizeRoles("developer"),
  getDeveloperReportController,
);

router.get("/admin", authorizeRoles("admin"), getAdminReportController);

router.get(
  "/finance-admin",
  authorizeRoles("finance_admin"),
  getFinanceAdminReportController,
);

export default router;
