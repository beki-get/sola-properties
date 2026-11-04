import type { RequestHandler } from "express";
import { FavoriteError } from "../queries/favoriteQueries.js";
import {
  addFavoriteService,
  getBuyerFavoritesService,
  removeFavoriteService,
} from "../services/favoriteService.js";
import {
  addFavoriteSchema,
  favoritePaginationSchema,
} from "../schemas/favoriteSchemas.js";

import { z } from "zod";

function handleFavoriteError(
  error: unknown,
  res: Parameters<RequestHandler>[1],
) {
  if (error instanceof FavoriteError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  res.status(500).json({
    message: "An unexpected error occurred.",
    code: "INTERNAL_SERVER_ERROR",
  });
}

export const addFavoriteController: RequestHandler = async (req, res) => {
  try {
    const validation = addFavoriteSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid request data",
        errors: validation.error.flatten(),
      });
      return;
    }

    const favorite = await addFavoriteService(
      req.currentUser!.id,
      validation.data.propertyId,
    );

    res.status(201).json({
      message: "Property added to favorites successfully",
      favorite,
    });
  } catch (error) {
    handleFavoriteError(error, res);
  }
};

export const getBuyerFavoritesController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const validation = favoritePaginationSchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid pagination parameters",
        errors: validation.error.flatten(),
      });
      return;
    }

    const { page, limit } = validation.data;

    const result = await getBuyerFavoritesService(
      req.currentUser!.id,
      page,
      limit,
    );

    res.status(200).json(result);
  } catch (error) {
    handleFavoriteError(error, res);
  }
};

export const removeFavoriteController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const propertyId = req.params.propertyId;

    const validation = z.string().uuid().safeParse(propertyId);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid property ID",
        code: "INVALID_PROPERTY_ID",
      });
      return;
    }

    await removeFavoriteService(
      req.currentUser!.id,
      validation.data,
    );

    res.status(200).json({
      message: "Favorite removed successfully",
    });
  } catch (error) {
    handleFavoriteError(error, res);
  }
};