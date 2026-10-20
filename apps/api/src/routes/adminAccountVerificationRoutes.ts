
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  decideRequest,
  getRequestDetails,
  listPendingRequests,
} from "../controllers/adminAccountVerificationController";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", listPendingRequests);
router.get("/:requestId", getRequestDetails);
router.patch("/:requestId/decision", decideRequest);

export default router;
