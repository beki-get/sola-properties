import type { RequestHandler, Response } from "express";
import { z } from "zod";

import {
  createBuyerVisitRequestService,
  getBuyerVisitsService,
  getSellerVisitsService,
  schedulePropertyVisitService,
  updatePropertyVisitService,
  cancelPropertyVisitService,
  recordPropertyVisitOutcomeService,
} from "../services/referralOperationsService.js";

import { ReferralOperationError } from "../queries/referralOperationsQueries.js";

import {
  createVisitRequestSchema,
  referralIdSchema,
  visitIdSchema,
  scheduleVisitSchema,
  updateVisitSchema,
  visitOutcomeSchema,
  visitPaginationSchema,
} from "../schemas/referralOperationsSchemas.js";

function requireCurrentUser(req: any) {
  if (!req.currentUser) {
    throw new ReferralOperationError(401, "UNAUTHENTICATED", "Unauthorized");
  }

  return req.currentUser;
}

function handleOperationError(error: unknown, res: Response) {
  if (error instanceof ReferralOperationError) {
    return res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return res.status(409).json({
      message: "An active visit already exists for this referral",
      code: "ACTIVE_VISIT_EXISTS",
    });
  }

  return res.status(500).json({
    message: "An unexpected error occurred",
    code: "INTERNAL_SERVER_ERROR",
  });
}

export const createBuyerVisitRequestController: RequestHandler = async (
  req,
  res,
) => {
  const referralId = referralIdSchema.safeParse(req.body.referralId);
  const body = createVisitRequestSchema.safeParse(req.body);

  if (!referralId.success || !body.success) {
    return res.status(400).json({
      message: "Invalid visit request data",
      code: "VALIDATION_ERROR",
      errors: {
        referralId: referralId.success ? undefined : referralId.error.flatten(),
        body: body.success ? undefined : body.error.flatten(),
      },
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const visit = await createBuyerVisitRequestService(
      currentUser.id,
      referralId.data,
      body.data,
    );

    return res.status(201).json({
      message: "Property visit requested successfully",
      data: visit,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const getBuyerVisitsController: RequestHandler = async (req, res) => {
  const pagination = visitPaginationSchema.safeParse(req.query);

  if (!pagination.success) {
    return res.status(400).json({
      message: "Invalid pagination parameters",
      code: "VALIDATION_ERROR",
      errors: pagination.error.flatten(),
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const result = await getBuyerVisitsService(
      currentUser.id,
      pagination.data.page,
      pagination.data.limit,
    );

    return res.status(200).json({
      message: "Buyer property visits retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const getSellerVisitsController: RequestHandler = async (req, res) => {
  const referralId = referralIdSchema.safeParse(req.params.referralId);
  const pagination = visitPaginationSchema.safeParse(req.query);

  if (!referralId.success || !pagination.success) {
    return res.status(400).json({
      message: "Invalid request parameters",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const result = await getSellerVisitsService(
      referralId.data,
      currentUser.id,
      pagination.data.page,
      pagination.data.limit,
    );

    return res.status(200).json({
      message: "Referral property visits retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const schedulePropertyVisitController: RequestHandler = async (
  req,
  res,
) => {
  const visitId = visitIdSchema.safeParse(req.params.visitId);
  const body = scheduleVisitSchema.safeParse(req.body);

  if (!visitId.success || !body.success) {
    return res.status(400).json({
      message: "Invalid scheduling data",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const visit = await schedulePropertyVisitService(
      visitId.data,
      currentUser.id,
      body.data,
    );

    return res.status(200).json({
      message: "Property visit scheduled successfully",
      data: visit,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const updatePropertyVisitController: RequestHandler = async (
  req,
  res,
) => {
  const visitId = visitIdSchema.safeParse(req.params.visitId);
  const body = updateVisitSchema.safeParse(req.body);

  if (!visitId.success || !body.success) {
    return res.status(400).json({
      message: "Invalid visit update data",
      code: "VALIDATION_ERROR",
      errors: body.success ? undefined : body.error.flatten(),
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const visit = await updatePropertyVisitService(
      visitId.data,
      currentUser.id,
      body.data,
    );

    return res.status(200).json({
      message: "Property visit updated successfully",
      data: visit,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const cancelPropertyVisitController: RequestHandler = async (
  req,
  res,
) => {
  const visitId = visitIdSchema.safeParse(req.params.visitId);

  if (!visitId.success) {
    return res.status(400).json({
      message: "Invalid visit ID",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const visit = await cancelPropertyVisitService(
      visitId.data,
      currentUser.id,
    );

    return res.status(200).json({
      message: "Property visit cancelled successfully",
      data: visit,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};

export const recordPropertyVisitOutcomeController: RequestHandler = async (
  req,
  res,
) => {
  const visitId = visitIdSchema.safeParse(req.params.visitId);
  const body = visitOutcomeSchema.safeParse(req.body);

  if (!visitId.success || !body.success) {
    return res.status(400).json({
      message: "Invalid visit outcome data",
      code: "VALIDATION_ERROR",
      errors: body.success ? undefined : body.error.flatten(),
    });
  }

  try {
    const currentUser = requireCurrentUser(req);
    const visit = await recordPropertyVisitOutcomeService(
      visitId.data,
      currentUser.id,
      body.data,
    );

    return res.status(200).json({
      message: "Property visit outcome recorded successfully",
      data: visit,
    });
  } catch (error) {
    return handleOperationError(error, res);
  }
};
