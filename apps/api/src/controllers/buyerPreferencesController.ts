import type { RequestHandler } from "express";
import {
  getBuyerPreferences,
  patchBuyerPreferences,
  replaceBuyerPreferences,
} from "../services/buyerPreferencesService";
import { updateBuyerPreferencesSchema } from "../schemas/buyerPreferencesSchemas";

export const getMyBuyerPreferences: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const preferences = await getBuyerPreferences(req.currentUser!.id);

    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
};

export const putMyBuyerPreferences: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = updateBuyerPreferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid preferences",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const preferences = await replaceBuyerPreferences(
      req.currentUser!.id,
      parsed.data,
    );

    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
};

export const patchMyBuyerPreferences: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = updateBuyerPreferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid preferences",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const preferences = await patchBuyerPreferences(
      req.currentUser!.id,
      parsed.data,
    );

    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
};