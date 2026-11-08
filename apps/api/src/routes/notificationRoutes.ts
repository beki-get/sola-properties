import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  getUnreadNotificationCountController,
  listNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
} from "../controllers/notificationController";

const router = Router();

router.use(authenticate);

router.get("/unread-count", getUnreadNotificationCountController);
router.get("/", listNotificationsController);
router.patch("/read-all", markAllNotificationsAsReadController);
router.patch("/:notificationId/read", markNotificationAsReadController);

export default router;