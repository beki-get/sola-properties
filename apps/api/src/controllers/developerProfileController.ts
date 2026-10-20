import type { RequestHandler } from "express";
import { updateDeveloperProfileSchema } from "../schemas/developerProfileSchemas";
import {
  getDeveloperProfile,
  updateDeveloperProfile,
} from "../services/developerProfileService";

export const getMyDeveloperProfile: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const profile = await getDeveloperProfile(req.currentUser.id);

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
};

export const updateMyDeveloperProfile: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const validation = updateDeveloperProfileSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid developer profile data",
        errors: validation.error.flatten(),
        code: "INVALID_PROFILE_DATA",
      });
      return;
    }

    const result = await updateDeveloperProfile(
      req.currentUser.id,
      validation.data,
    );

    if (!result.success) {
      res.status(400).json({
        message: "Complete the required fields to create your profile",
        missingFields: result.missingFields,
        code: "PROFILE_FIELDS_REQUIRED",
      });
      return;
    }

    res.status(200).json({
      message: "Developer profile updated successfully",
      profile: result.profile,
    });
  } catch (error) {
    next(error);
  }
};