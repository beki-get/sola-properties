import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount.js";

import {
  createBuyerVisitRequestController,
  getBuyerVisitsController,
  getSellerVisitsController,
  schedulePropertyVisitController,
  updatePropertyVisitController,
  cancelPropertyVisitController,
  recordPropertyVisitOutcomeController,
} from "../controllers/referralOperationsController.js";

const router = Router();

router.use(authenticate);

// Buyer: request and view their own visits.
router.post(
  "/buyer/me/visits",
  authorizeRoles("buyer"),
  requireApprovedAccount,
  createBuyerVisitRequestController,
);

router.get(
  "/buyer/me/visits",
  authorizeRoles("buyer"),
  requireApprovedAccount,
  getBuyerVisitsController,
);

// Assigned agent/developer: view visits for a referral.
router.get(
  "/:referralId/visits",
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
  getSellerVisitsController,
);

// Assigned agent/developer: schedule a buyer's request.
router.patch(
  "/visits/:visitId/schedule",
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
  schedulePropertyVisitController,
);

// Assigned agent/developer: update a scheduled visit.
router.patch(
  "/visits/:visitId",
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
  updatePropertyVisitController,
);

// Buyer or assigned agent/developer: cancel a visit.
router.patch(
  "/visits/:visitId/cancel",
  authorizeRoles("buyer", "agent", "developer"),
  requireApprovedAccount,
  cancelPropertyVisitController,
);

// Assigned agent/developer: record or update an outcome.
router.patch(
  "/visits/:visitId/outcome",
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
  recordPropertyVisitOutcomeController,
);

export default router;