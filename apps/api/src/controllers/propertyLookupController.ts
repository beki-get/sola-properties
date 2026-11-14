import type { RequestHandler } from "express";
import { z } from "zod";
import { listPropertyLookups } from "../services/adminService";

const includeInactiveQuerySchema = z
  .object({
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export const listPropertyCategoriesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = includeInactiveQuerySchema.safeParse(req.query);
    const includeInactive =
      parsed.success &&
      parsed.data.includeInactive &&
      req.currentUser?.role === "admin";

    const result = await listPropertyLookups("category", {
      includeInactive,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const listPropertyLocationsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = includeInactiveQuerySchema.safeParse(req.query);
    const includeInactive =
      parsed.success &&
      parsed.data.includeInactive &&
      req.currentUser?.role === "admin";

    const result = await listPropertyLookups("location", {
      includeInactive,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
