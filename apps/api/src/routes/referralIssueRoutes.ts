import { Router } from "express";

import { authenticate } from "../middlewares/authenticate";

import {
  createReferralIssueController,
  getMyReferralIssuesController,
  getAdminReferralIssuesController,
  getAdminReferralIssueByIdController,
  updateReferralIssueController,
} from "../controllers/referralController";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, requireApprovedAccount);

// Buyer, agent, and developer
router.post(
  "/",
  authorizeRoles("buyer", "agent", "developer"),
  createReferralIssueController,
);

router.get(
  "/me",
  authorizeRoles("buyer", "agent", "developer"),
  getMyReferralIssuesController,
);

// Admin
router.get("/admin", authorizeRoles("admin"), getAdminReferralIssuesController);

router.get(
  "/admin/:issueId",
  authorizeRoles("admin"),
  getAdminReferralIssueByIdController,
);

router.patch(
  "/admin/:issueId",
  authorizeRoles("admin"),
  updateReferralIssueController,
);

export default router;
