import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  getBuyerProfileController,
  updateBuyerProfileController,
} from "../controllers/buyerProfileController";

const router = Router();

router.use(authenticate, authorizeRoles("buyer"));

router.get("/me", getBuyerProfileController);
router.patch("/me", updateBuyerProfileController);

export default router;