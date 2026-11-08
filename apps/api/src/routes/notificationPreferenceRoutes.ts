import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  getNotificationPreferencesController,
  updateNotificationPreferenceController,
} from "../controllers/notificationPreferenceController";

const router = Router();

router.use(authenticate);

router.get("/", getNotificationPreferencesController);
router.patch("/", updateNotificationPreferenceController);

export default router;
