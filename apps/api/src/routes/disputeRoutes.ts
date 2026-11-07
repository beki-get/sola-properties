import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  decideTransactionDisputeController,
  openTransactionDisputeController,
  listTransactionDisputesController,
  openCommissionDisputeController,
  listCommissionDisputesController,
} from "../controllers/disputeController";

const router = Router();

router.use(authenticate, requireApprovedAccount);

//admin only
router.patch(
  "/:disputeId/decision",
  authorizeRoles("admin", "finance_admin"),
  decideTransactionDisputeController,
);

//transaction disputes
router.post(
  "/:transactionId/disputes",
  authorizeRoles("agent", "developer", "admin", "finance_admin"),
  openTransactionDisputeController,
);

router.get(
  "/:transactionId/disputes",
  authorizeRoles("agent", "developer", "admin", "finance_admin"),
  listTransactionDisputesController,
);

// Commission dispute routes.
router.post(
  "/commissions/:commissionId/disputes",
  authorizeRoles("agent", "developer"),
  openCommissionDisputeController,
);

router.get(
  "/commissions/:commissionId/disputes",
  authorizeRoles("agent", "developer", "admin", "finance_admin"),
  listCommissionDisputesController,
);

export default router;
