import { Router } from "express";
import {
  createReferralController,
  getMyReferralsController,
  respondToReferralController,
  updateReferralStatusController,
  reassignReferralController,
  getAllReferralsController,
  getReferralDetailsController,
  getReferralHistoryController,
  getBuyerReferralsController,
  createReferralFollowUpController,
  getReferralFollowUpsController,
   createReferralMessageController,
  getReferralMessagesController,
} from "../controllers/referralController";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";

const router = Router();

router.use(authenticate, requireApprovedAccount);

router.post("/", authorizeRoles("buyer"), createReferralController); //create referral

router.get(
  "/buyer/me",
  authorizeRoles("buyer"),
  requireApprovedAccount,
  getBuyerReferralsController,
); //get my referrals for buyer

router.get(
  "/me",
  authorizeRoles("agent", "developer"),
  getMyReferralsController,
); //get my referrals for agent or developer

router.patch(
  "/:referralId/decision",
  authorizeRoles("agent", "developer"),
  respondToReferralController,
); //respond to referral
router.patch(
  "/:referralId/status",
  authorizeRoles("agent", "developer"),
  updateReferralStatusController,
); //update referral status

router.get(
  "/admin",
  authorizeRoles("admin"),
  requireApprovedAccount,
  getAllReferralsController,
); //get all referrals for admin

router.get(
  "/admin/:referralId",
  authorizeRoles("admin"),
  requireApprovedAccount,
  getReferralDetailsController,
); //get referral details for admin

router.patch(
  "/admin/:referralId/reassign",
  authorizeRoles("admin"),
  reassignReferralController,
); //reassign referral to another agent or developer

router.get(
  "/admin/:referralId/history",
  authorizeRoles("admin"),
  requireApprovedAccount,
  getReferralHistoryController,
); //get referral history for admin

// Assigned agents/developers can record follow-ups.
router.post(
  "/:referralId/follow-ups",
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
  createReferralFollowUpController,
);

// Assigned agents/developers and admins can read follow-ups.
router.get(
  "/:referralId/follow-ups",
  authorizeRoles("agent", "developer", "admin"),
  requireApprovedAccount,
  getReferralFollowUpsController,
);

//messages
// Buyer and assigned seller can send messages.
router.post(
  "/:referralId/messages",
  authorizeRoles("buyer", "agent", "developer"),
  createReferralMessageController,
);

// Buyer, assigned seller, and admin can read messages.
router.get(
  "/:referralId/messages",
  authorizeRoles("buyer", "agent", "developer", "admin"),
  getReferralMessagesController,
);

export default router;
