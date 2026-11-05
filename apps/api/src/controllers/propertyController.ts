import type { RequestHandler, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createPropertySchema,
  propertyListQuerySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
  publicPropertyListQuerySchema,
  comparePropertiesQuerySchema,
   adminPendingPropertyListQuerySchema,
  adminPropertyDecisionSchema,
} from "../schemas/propertySchemas";
import {
  createProperty,
  getMyProperties,
  getMyProperty,
  updateProperty,
  updatePropertyStatus,
  uploadPropertyImages as savePropertyImages,
  getPropertyImages,
  deletePropertyImage,
  listPublicProperties,
  getPublicProperty,
  comparePublicProperties,
  listRecommendedProperties,
   getAdminPendingProperties,
  getAdminPendingProperty,
  decideAdminProperty,
  getMyPropertyHistoryService,
} from "../services/propertyService";
import { PropertyQueryError } from "../queries/propertyQueries";

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof PropertyQueryError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  next(error);
}

function getOwnerRole(role: string): "agent" | "developer" | null {
  return role === "agent" || role === "developer" ? role : null;
}

function readPropertyId(req: Parameters<RequestHandler>[0], res: Response) {
  const parsed = z.string().uuid().safeParse(req.params.propertyId);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid property ID",
      code: "INVALID_PROPERTY_ID",
    });
    return null;
  }

  return parsed.data;
}

export const createPropertyController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const role = getOwnerRole(req.currentUser!.role);

    if (!role) {
      res.status(403).json({
        message: "Only agents and developers can create properties",
        code: "ROLE_NOT_ALLOWED",
      });
      return;
    }

    const parsed = createPropertySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid property data",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const property = await createProperty(
      req.currentUser!.id,
      role,
      parsed.data,
    );

    res.status(201).json({ property });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getMyPropertiesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = propertyListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid property query",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const result = await getMyProperties(req.currentUser!.id, parsed.data);

    res.json(result);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getMyPropertyController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const property = await getMyProperty(req.currentUser!.id, propertyId);

    res.json({ property });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const updatePropertyController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const role = getOwnerRole(req.currentUser!.role);

    if (!role) {
      res.status(403).json({
        message: "Only agents and developers can update properties",
        code: "ROLE_NOT_ALLOWED",
      });
      return;
    }

    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const parsed = updatePropertySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid property data",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const property = await updateProperty(
      req.currentUser!.id,
      role,
      propertyId,
      parsed.data,
    );

    res.json({ property });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const updatePropertyStatusController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const parsed = updatePropertyStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid property status",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const property = await updatePropertyStatus(
      req.currentUser!.id,
      propertyId,
      parsed.data.status,
    );

    res.json({ property });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const uploadPropertyImagesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const files = (req.files ?? []) as Express.Multer.File[];

    if (files.length === 0) {
      res.status(400).json({
        message: "Upload at least one image",
        code: "IMAGES_REQUIRED",
      });
      return;
    }

    const validFiles = files.map((file) => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype as "image/jpeg" | "image/png" | "image/webp",
      size: file.size,
    }));

    const images = await savePropertyImages(
      req.currentUser!.id,
      propertyId,
      validFiles,
    );

    res.status(201).json({ images });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPropertyImagesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const images = await getPropertyImages(req.currentUser!.id, propertyId);

    res.json({ images });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const deletePropertyImageController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const parsedImageId = z.string().uuid().safeParse(req.params.imageId);

    if (!parsedImageId.success) {
      res.status(400).json({
        message: "Invalid image ID",
        code: "INVALID_PROPERTY_IMAGE_ID",
      });
      return;
    }

    const result = await deletePropertyImage(
      req.currentUser!.id,
      propertyId,
      parsedImageId.data,
    );

    res.json(result);
  } catch (error) {
    handleError(error, res, next);
  }
};

// Public property controllers
export const listPublicPropertiesController: RequestHandler = async (
  req, res, next,
) => {
  try {
    const parsed = publicPropertyListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid property filters",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    res.json(await listPublicProperties(parsed.data));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPublicPropertyController: RequestHandler = async (
  req, res, next,
) => {
  try {
    const propertyId = readPropertyId(req, res);
    if (!propertyId) return;

    const property = await getPublicProperty(propertyId);

    if (!property) {
      res.status(404).json({
        message: "Property not found",
        code: "PROPERTY_NOT_FOUND",
      });
      return;
    }

    res.json({ property });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const comparePropertiesController: RequestHandler = async (
  req, res, next,
) => {
  try {
    const parsed = comparePropertiesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Provide 2–4 unique, valid property IDs",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const properties = await comparePublicProperties(parsed.data.ids);

    if (properties.length !== parsed.data.ids.length) {
      res.status(404).json({
        message: "One or more properties were not found or are unavailable",
        code: "PROPERTY_NOT_FOUND",
      });
      return;
    }

    res.json({ properties });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const recommendedPropertiesController: RequestHandler = async (
  req, res, next,
) => {
  try {
    const properties = await listRecommendedProperties(req.currentUser!.id);
    res.json({ properties });
  } catch (error) {
    handleError(error, res, next);
  }
};

// Admin property controllers
export const getAdminPendingPropertiesController: RequestHandler =
  async (req, res, next) => {
    try {
      const parsed = adminPendingPropertyListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid pagination parameters",
          code: "VALIDATION_ERROR",
          errors: parsed.error.flatten(),
        });
        return;
      }

      const result = await getAdminPendingProperties(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      handleError(error, res, next);
    }
  };

export const getAdminPendingPropertyController: RequestHandler =
  async (req, res, next) => {
    try {
      const propertyId = readPropertyId(req, res);
      if (!propertyId) return;

      const property = await getAdminPendingProperty(propertyId);
      res.status(200).json({ property });
    } catch (error) {
      handleError(error, res, next);
    }
  };

export const decideAdminPropertyController: RequestHandler =
  async (req, res, next) => {
    try {
      const propertyId = readPropertyId(req, res);
      if (!propertyId) return;

      const parsed = adminPropertyDecisionSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid property decision",
          code: "VALIDATION_ERROR",
          errors: parsed.error.flatten(),
        });
        return;
      }

      const property = await decideAdminProperty(
        propertyId,
        req.currentUser!.id,
        parsed.data,
      );

      res.status(200).json({ property });
    } catch (error) {
      handleError(error, res, next);
    }
  };

  export const getMyPropertyHistoryController: RequestHandler =
  async (req, res, next) => {
    try {
      const propertyId = readPropertyId(req, res);
      if (!propertyId) return;

      const history = await getMyPropertyHistoryService(
        req.currentUser!.id,
        propertyId,
      );

      res.status(200).json({
        message: "Property history retrieved successfully",
        data: history,
      });
    } catch (error) {
      handleError(error, res, next);
    }
  };