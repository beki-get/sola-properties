import type { RequestHandler } from "express";
import {
  AccountVerificationError,
  decideVerificationRequest,
  getVerificationRequestForAdmin,
  listPendingVerificationRequests,
} from "../services/accountVerificationService";

function handleError(
  error: unknown,
  next: (error?: unknown) => void,
  res: Parameters<RequestHandler>[1],
) {
  if (error instanceof AccountVerificationError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  next(error);
}

export const listPendingRequests: RequestHandler = async (req, res, next) => {
  try {
    const pageValue = Number(req.query.page ?? 1);
    const pageSizeValue = Number(req.query.pageSize ?? 20);

    if (
      !Number.isInteger(pageValue) ||
      !Number.isInteger(pageSizeValue) ||
      pageValue < 1 ||
      pageSizeValue < 1
    ) {
      res.status(400).json({
        message: "page and pageSize must be positive integers",
        code: "INVALID_PAGINATION",
      });
      return;
    }

    const result = await listPendingVerificationRequests(
      pageValue,
      pageSizeValue,
    );

    res.status(200).json(result);
  } catch (error: unknown) {
    handleError(error, next, res);
  }
};

export const getRequestDetails: RequestHandler = async (req, res, next) => {
  try {
    const request = await getVerificationRequestForAdmin(req.params.requestId!);

    res.status(200).json({ request });
  } catch (error: unknown) {
    handleError(error, next, res);
  }
};

export const decideRequest: RequestHandler = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const { decision, rejectionReason } = req.body ?? {};

    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({
        message: 'decision must be "approved" or "rejected"',
        code: "INVALID_DECISION",
      });
      return;
    }

    if (rejectionReason !== undefined && typeof rejectionReason !== "string") {
      res.status(400).json({
        message: "rejectionReason must be a string",
        code: "INVALID_REJECTION_REASON",
      });
      return;
    }

    const request = await decideVerificationRequest(
      req.currentUser.id,
      req.params.requestId!,
      decision,
      rejectionReason,
    );

    res.status(200).json({
      message: `Verification request ${decision}`,
      request,
    });
  } catch (error: unknown) {
    handleError(error, next, res);
  }
};
