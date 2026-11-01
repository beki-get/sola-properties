import { Router } from "express";
import {
  authorizeAgentController,
  getApprovedAgentController,
  listAgentAuthorizedPropertiesController,
  listApprovedAgentsController,
  listAuthorizedAgentsController,
  revokeAgentAuthorizationController,
} from "../controllers/propertyAuthorizationController";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";

const router = Router();

// Developer: browse approved agents.
router.get(
  "/developer/agents",
  authenticate,
  authorizeRoles("developer"),
  requireApprovedAccount,
  listApprovedAgentsController,
);

// Developer: view a specific approved agent.
router.get(
  "/developer/agents/:agentId",
  authenticate,
  authorizeRoles("developer"),
  requireApprovedAccount,
  getApprovedAgentController,
);

// Developer: manage agents authorized for an owned property.
router.post(
  "/developer/properties/:propertyId/agents",
  authenticate,
  authorizeRoles("developer"),
  requireApprovedAccount,
  authorizeAgentController,
);

// Developer: view currently authorized agents for an owned property.
router.get(
  "/developer/properties/:propertyId/agents",
  authenticate,
  authorizeRoles("developer"),
  requireApprovedAccount,
  listAuthorizedAgentsController,
);

// Developer: revoke an agent's authorization for an owned property.
router.patch(
  "/developer/properties/:propertyId/agents/:agentId",
  authenticate,
  authorizeRoles("developer"),
  requireApprovedAccount,
  revokeAgentAuthorizationController,
);

// Agent: view currently authorized properties.
router.get(
  "/agent/authorized-properties",
  authenticate,
  authorizeRoles("agent"),
  requireApprovedAccount,
  listAgentAuthorizedPropertiesController,
);

export default router;
