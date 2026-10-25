import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

import { z } from "zod";

import { projectListQuerySchema } from "../schemas/projectSchemas";

import {
  getAdminProject,
  getAdminProjects,
  ProjectServiceError,
} from "../services/projectService";

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

export const getAllProjectsAdminController: RequestHandler = async (
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

    const result = await getAdminProjects(parsed.data);

    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getProjectAdminController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const projectId = readProjectId(req, res);
    if (!projectId) return;

    const project = await getAdminProject(projectId);

    res.status(200).json({ project });
  } catch (error) {
    handleError(error, res, next);
  }
};