import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import { uploadTransactionDocuments } from "../middlewares/transactionDocuments";
import {
  createTransactionController,
  decideTransactionController,
  getTransactionController,
  getTransactionDocumentsController,
  listTransactionsController,
  updateTransactionController,
  uploadTransactionDocumentsController,
} from "../controllers/transactionController";

const router = Router();

router.use(authenticate, requireApprovedAccount);

router.post(
  "/",
  authorizeRoles("agent", "developer"),
  createTransactionController,
);

router.get(
  "/",
  authorizeRoles("buyer", "agent", "developer", "admin", "finance_admin"),
  listTransactionsController,
);

router.get(
  "/:transactionId",
  authorizeRoles("buyer", "agent", "developer", "admin", "finance_admin"),
  getTransactionController,
);

router.patch(
  "/:transactionId",
  authorizeRoles("agent", "developer"),
  updateTransactionController,
);

router.get(
  "/:transactionId/documents",
  authorizeRoles("buyer", "agent", "developer", "admin", "finance_admin"),
  getTransactionDocumentsController,
);

router.post(
  "/:transactionId/documents",
  authorizeRoles("agent", "developer"),
  uploadTransactionDocuments,
  uploadTransactionDocumentsController,
);

router.post(
  "/:transactionId/decision",
  authorizeRoles("admin", "finance_admin"),
  decideTransactionController,
);

export default router;
