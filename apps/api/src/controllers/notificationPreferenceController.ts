import type { RequestHandler } from "express";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreference,
} from "../services/notificationService";
import { notificationPreferenceUpdateSchema } from "../schemas/notificationSchema";

//get notification preferences
export const getNotificationPreferencesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const preferences = await getUserNotificationPreferences(
      req.currentUser!.id,
    );

    res.status(200).json({
      message: "Notification preferences retrieved successfully.",
      preferences,
    });
  } catch (error) {
    next(error);
  }
};

//update notification preference
export const updateNotificationPreferenceController: RequestHandler = async (
  req,
  res,
  next,
) => {
  const parsed = notificationPreferenceUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid notificationType and isEnabled value are required.",
      code: "INVALID_NOTIFICATION_PREFERENCE",
    });
    return;
  }

  try {
    const preference = await updateUserNotificationPreference(
      req.currentUser!.id,
      parsed.data,
    );

    res.status(200).json({
      message: "Notification preference updated successfully.",
      preference,
    });
  } catch (error) {
    next(error);
  }
};