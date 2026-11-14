import type { RequestHandler } from "express";
import {
  createAdminUser,
  getAuditLogs,
  getUserById,
  getUsers,
  updateUserStatus,
  createPropertyLookup,
  updatePropertyLookupEntry,
  exportUsers,
} from "../services/adminService";
import {
  adminUserCreateSchema,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  adminUserStatusUpdateSchema,
  adminPropertyLookupCreateSchema,
  adminPropertyLookupIdParamsSchema,
  adminPropertyLookupUpdateSchema,
  auditLogFiltersSchema,
} from "../schemas/adminSchemas";

export const createPropertyCategoryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const validation = adminPropertyLookupCreateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid property category payload",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await createPropertyLookup(
      "category",
      validation.data,
      req.currentUser.id,
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updatePropertyCategoryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const paramsValidation = adminPropertyLookupIdParamsSchema.safeParse(
      req.params,
    );
    const bodyValidation = adminPropertyLookupUpdateSchema.safeParse(req.body);

    if (!paramsValidation.success) {
      res.status(400).json({
        message: "Invalid property category id",
        code: "VALIDATION_ERROR",
        errors: paramsValidation.error.flatten(),
      });
      return;
    }

    if (!bodyValidation.success) {
      res.status(400).json({
        message: "Invalid property category update payload",
        code: "VALIDATION_ERROR",
        errors: bodyValidation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await updatePropertyLookupEntry(
      "category",
      paramsValidation.data.id,
      bodyValidation.data,
      req.currentUser.id,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createPropertyLocationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const validation = adminPropertyLookupCreateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid property location payload",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await createPropertyLookup(
      "location",
      validation.data,
      req.currentUser.id,
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updatePropertyLocationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const paramsValidation = adminPropertyLookupIdParamsSchema.safeParse(
      req.params,
    );
    const bodyValidation = adminPropertyLookupUpdateSchema.safeParse(req.body);

    if (!paramsValidation.success) {
      res.status(400).json({
        message: "Invalid property location id",
        code: "VALIDATION_ERROR",
        errors: paramsValidation.error.flatten(),
      });
      return;
    }

    if (!bodyValidation.success) {
      res.status(400).json({
        message: "Invalid property location update payload",
        code: "VALIDATION_ERROR",
        errors: bodyValidation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await updatePropertyLookupEntry(
      "location",
      paramsValidation.data.id,
      bodyValidation.data,
      req.currentUser.id,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const validation = auditLogFiltersSchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid audit log query parameters",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await getAuditLogs(validation.data);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

//get all users for admin
export const getUsersController: RequestHandler = async (req, res, next) => {
  try {
    const validation = adminUserListQuerySchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid admin user query parameters",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await getUsers(validation.data);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

//export all users for admin
export const exportUsersController: RequestHandler = async (req, res, next) => {
  try {
    const validation = adminUserListQuerySchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid admin user export parameters",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    const csv = await exportUsers(validation.data);

    res
      .status(200)
      .setHeader("Content-Type", "text/csv; charset=utf-8")
      .setHeader("Content-Disposition", 'attachment; filename="sola-users.csv"')
      .setHeader("Cache-Control", "no-store")
      .send(csv);
  } catch (error) {
    next(error);
  }
};

export const getUserByIdController: RequestHandler = async (req, res, next) => {
  try {
    const validation = adminUserIdParamsSchema.safeParse(req.params);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid user id",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await getUserById(validation.data.id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createAdminUserController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const validation = adminUserCreateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid user payload",
        code: "VALIDATION_ERROR",
        errors: validation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await createAdminUser(validation.data, req.currentUser.id);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUserStatusController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const paramsValidation = adminUserIdParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      res.status(400).json({
        message: "Invalid user id",
        code: "VALIDATION_ERROR",
        errors: paramsValidation.error.flatten(),
      });
      return;
    }

    const bodyValidation = adminUserStatusUpdateSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        message: "Invalid user status update payload",
        code: "VALIDATION_ERROR",
        errors: bodyValidation.error.flatten(),
      });
      return;
    }

    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await updateUserStatus(
      paramsValidation.data.id,
      bodyValidation.data,
      req.currentUser.id,
      req.currentUser.role === "admin" ||
        req.currentUser.role === "finance_admin"
        ? req.currentUser.role
        : "admin",
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
