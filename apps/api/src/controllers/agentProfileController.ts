import type { RequestHandler } from "express";
import { updateAgentProfileSchema } from "../schemas/agentProfileSchemas";
import {
  getAgentProfile,
  updateAgentProfile,
} from "../services/agentProfileService";

export const getMyAgentProfile: RequestHandler = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const profile = await getAgentProfile(req.currentUser.id);

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
};


export const updateMyAgentProfile: RequestHandler = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const validation = updateAgentProfileSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid profile data",
        errors: validation.error.flatten(),
        code: "INVALID_PROFILE_DATA",
      });
      return;
    }

    const profile = await updateAgentProfile(
      req.currentUser.id,
      validation.data,
    );
    res.status(200).json({
      message: "Agent profile updated successfully",
      profile,
    });
  } catch (error) {
    next(error);
  }
};
