
import { Router } from "express";
import {
  createReferralController,
  getMyReferralsController,
  respondToReferralController,
  updateReferralStatusController,
} from "../controllers/referralController";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";

const router = Router();

router.use(authenticate, authorizeRoles("buyer", "agent", "developer"), requireApprovedAccount);

router.post("/", authorizeRoles("buyer"), createReferralController);
router.get("/me", authorizeRoles("agent", "developer"), getMyReferralsController);
router.patch("/:referralId/decision", authorizeRoles("agent", "developer"), respondToReferralController);
router.patch("/:referralId/status", authorizeRoles("agent", "developer"), updateReferralStatusController);

export default router;
