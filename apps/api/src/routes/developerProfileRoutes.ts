import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  getMyDeveloperProfile,
  updateMyDeveloperProfile,
} from "../controllers/developerProfileController";

const router = Router();

router.use(authenticate, authorizeRoles("developer"));

router.get("/me", getMyDeveloperProfile);
router.patch("/me", updateMyDeveloperProfile);

export default router;