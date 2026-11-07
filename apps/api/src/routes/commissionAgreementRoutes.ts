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
   createCommissionAdjustmentController
} from "../controllers/commissionAgreementController";

const router = Router();

router.use(authenticate, requireApprovedAccount);

// Commission agreement retrieval
router.get(
  "/",
  authorizeRoles("admin", "finance_admin", "agent", "developer"),
  getCommissionAgreementsController,
);

// Commission agreement creation
router.post(
  "/",
  authorizeRoles("admin", "finance_admin"),
  createCommissionAgreementController,
);

// Commission records

// for retrieving commission records
router.get(
  "/commissions",
  authorizeRoles("admin", "finance_admin", "agent", "developer"),
  getCommissionsController,
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
  authorizeRoles("admin", "finance_admin"),
  approveCommissionController,
);

// Commission adjustments
router.post(
  "/:id/adjustments",
 
  authorizeRoles("admin", "finance_admin"),
  createCommissionAdjustmentController,
);

//recording payments.
router.post(
  "/commissions/:id/payments",
  authorizeRoles("admin", "finance_admin"),
  recordCommissionPaymentController,
);

export default router;
