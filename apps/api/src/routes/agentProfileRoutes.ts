import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  getMyAgentProfile,
  updateMyAgentProfile,
} from "../controllers/agentProfileController";

const router = Router();

router.use(authenticate, authorizeRoles("agent"));

router.get("/me", getMyAgentProfile);
router.patch("/me", updateMyAgentProfile);

export default router;