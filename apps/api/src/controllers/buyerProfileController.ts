import type { RequestHandler } from "express";
import { ZodError } from "zod";
import {
  BuyerProfileServiceError,
  getBuyerProfile,
  updateBuyerProfile,
} from "../services/buyerProfileService";
import { updateBuyerProfileSchema } from "../schemas/buyerProfileSchemas";
import { logger } from "../utils/logger";

export const getBuyerProfileController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const userId = req.currentUser!.id;
    const profile = await getBuyerProfile(userId);

    res.status(200).json({
      message: "Buyer profile retrieved successfully",
      data: profile,
    });
  } catch (error) {
    if (error instanceof BuyerProfileServiceError) {
      res.status(404).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    logger.error(
      { err: error },
      "Failed to retrieve buyer profile",
    );

    res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

export const updateBuyerProfileController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const parsed = updateBuyerProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const userId = req.currentUser!.id;
    const profile = await updateBuyerProfile(userId, parsed.data);

    res.status(200).json({
      message: "Buyer profile saved successfully",
      data: profile,
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to save buyer profile",
    );

    res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};