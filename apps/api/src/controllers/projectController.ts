import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

import { z } from "zod";

import {
  createProjectSchema,
  projectListQuerySchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "../schemas/projectSchemas";

import {
  createDeveloperProject,
  getDeveloperProject,
  getDeveloperProjects,
  ProjectServiceError,
  setDeveloperProjectStatus,
  updateProjectDetails,
  getDeveloperProjectProperties,
} from "../services/projectService";
import { propertyListQuerySchema } from "../schemas/propertySchemas";
function handleError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof ProjectServiceError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  next(error);
}

function readProjectId(req: Request, res: Response): string | null {
  const result = z.string().uuid().safeParse(req.params.projectid);

  if (!result.success) {
    res.status(400).json({
      message: "Invalid project ID",
      code: "INVALID_PROJECT_ID",
    });
    return null;
  }

  return result.data;
}

export const createProjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid project data",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const project = await createDeveloperProject(
      req.currentUser!.id,
      parsed.data,
    );

    res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getMyProjectsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const parsed = projectListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid pagination or filter parameters",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const result = await getDeveloperProjects(
      req.currentUser!.id,
      parsed.data,
    );

    res.status(200).json({result, message: "Projects retrieved successfully" });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getMyProjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const projectId = readProjectId(req, res);
    if (!projectId) return;

    const project = await getDeveloperProject(
      projectId,
      req.currentUser!.id,
    );

    res.status(200).json({ message: "Project retrieved successfully", project });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const updateProjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const projectId = readProjectId(req, res);
    if (!projectId) return;

    const parsed = updateProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid project update",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const project = await updateProjectDetails(
      projectId,
      req.currentUser!.id,
      parsed.data,
    );

    res.status(200).json({ message:"Project Updated successfully",project });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const updateProjectStatusController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const projectId = readProjectId(req, res);
    if (!projectId) return;

    const parsed = updateProjectStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid project status",
        code: "VALIDATION_ERROR",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const project = await setDeveloperProjectStatus(
      projectId,
      req.currentUser!.id,
      req.currentUser!.id,
      parsed.data.status,
    );

    res.status(200).json({ message:"Project status updated", project });
  } catch (error) {
    handleError(error, res, next);
  }
};


export const getDeveloperProjectPropertiesController: RequestHandler =
  async (req, res, next) => {
    try {
      const projectId = readProjectId(req, res);
      if (!projectId) return;

      const parsed = propertyListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid pagination parameters",
          code: "VALIDATION_ERROR",
          errors: parsed.error.flatten(),
        });
        return;
      }

      const result = await getDeveloperProjectProperties(
        projectId,
        req.currentUser!.id,
        {
          page: parsed.data.page,
          limit: parsed.data.limit,
        },
      );

      res.status(200).json({
        message: "Project properties retrieved successfully",
        result,
      });
    } catch (error) {
      handleError(error, res, next);
    }
  };
