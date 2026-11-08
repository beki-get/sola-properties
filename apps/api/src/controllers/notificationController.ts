import type { RequestHandler } from "express";
import {
  getUserNotifications,
  getUserUnreadNotificationCount,
  markUserNotificationAsRead,
  markAllUserNotificationsAsRead,
} from "../services/notificationService";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "../schemas/notificationSchema";

export const listNotificationsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  const parsed = notificationListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid notification pagination or filter parameters.",
      code: "INVALID_NOTIFICATION_QUERY",
    });
    return;
  }

  try {
    const result = await getUserNotifications({
      userId: req.currentUser!.id,
      ...parsed.data,
    });

    res.status(200).json({
      message: "Notifications retrieved successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCountController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const count = await getUserUnreadNotificationCount(req.currentUser!.id);

    res.status(200).json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsReadController: RequestHandler = async (
  req,
  res,
  next,
) => {
  const parsed = notificationIdParamSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid notification ID is required.",
      code: "INVALID_NOTIFICATION_ID",
    });
    return;
  }

  try {
    const notification = await markUserNotificationAsRead({
      notificationId: parsed.data.notificationId,
      userId: req.currentUser!.id,
    });

    if (!notification) {
      res.status(404).json({
        message: "Notification not found.",
        code: "NOTIFICATION_NOT_FOUND",
      });
      return;
    }

    res.status(200).json({
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsAsReadController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const updatedCount = await markAllUserNotificationsAsRead(
      req.currentUser!.id,
    );

    res.status(200).json({
      message: "All notifications marked as read.",
      updatedCount,
    });
  } catch (error) {
    next(error);
  }
};