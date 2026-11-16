import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import {
  createCommissionAgreementController,
  getCommissionAgreementsController,
  getCommissionsController,
  getCommissionStatementController,
  approveCommissionController,
  recordCommissionPaymentController,
  createCommissionAdjustmentController,
  exportCommissionsController,
} from "../controllers/commissionAgreementController";

const router = Router();

router.use(authenticate, requireApprovedAccount);

// Commission agreement retrieval
router.get(
  "/commission-agreements",
  authorizeRoles("admin", "finance_admin", "agent", "developer"),
  getCommissionAgreementsController,
);

// Commission agreement creation
router.post(
  "/commission-agreements",
  authorizeRoles("finance_admin"),
  createCommissionAgreementController,
);

// Commission records

// for retrieving commission records
router.get(
  "/commissions",
  authorizeRoles("admin", "finance_admin", "agent", "developer"),
  getCommissionsController,
);

//export commission
router.get(
  "/commissions/export",
  authorizeRoles("finance_admin"),
  exportCommissionsController,
);

// Commission statement
router.get(
  "/commissions/:id",
  authorizeRoles("admin", "finance_admin", "agent", "developer"),
  getCommissionStatementController,
);

// approving commissions
router.post(
  "/commissions/:id/approve",
  authorizeRoles("finance_admin"),
  approveCommissionController,
);

// Commission adjustments
router.post(
  "/commissions/:id/adjustments",

  authorizeRoles("finance_admin"),
  createCommissionAdjustmentController,
);

//recording payments.
router.post(
  "/commissions/:id/payments",
  authorizeRoles("finance_admin"),
  recordCommissionPaymentController,
);

export default router;
