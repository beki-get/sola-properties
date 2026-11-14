import type { Request, Response, NextFunction } from "express";
import {
  getAdminReportService,
  getAgentReportService,
  getDeveloperReportService,
  getFinanceAdminReportService,
} from "../services/reportService";

export async function getAgentReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.currentUser) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const data = await getAgentReportService(req.currentUser.id);

    return res.status(200).json({
      message: "Agent report retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getDeveloperReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.currentUser) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const data = await getDeveloperReportService(req.currentUser.id);

    return res.status(200).json({
      message: "Developer report retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminReportController(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getAdminReportService();

    return res.status(200).json({
      message: "Admin report retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getFinanceAdminReportController(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getFinanceAdminReportService();

    return res.status(200).json({
      message: "Finance admin report retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}
