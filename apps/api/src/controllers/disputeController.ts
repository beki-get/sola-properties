
import type { RequestHandler } from "express";
import { TransactionError } from "../queries/transactionQueries";
import {
  decideTransactionDispute,
  getTransactionDisputes,
  openTransactionDispute,
    openCommissionDispute,
  getCommissionDisputes,
} from "../services/disputeService";
import {
  disputeDecisionSchema,
  disputeListQuerySchema,
  disputeSubmissionSchema,
} from "../schemas/disputeSchemas";

function handleDisputeError(
  error: unknown,
  res: Parameters<RequestHandler>[1],
) {
  if (error instanceof TransactionError) {
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

export const openTransactionDisputeController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = disputeSubmissionSchema.safeParse(req.body);
  const transactionId = req.params.transactionId;

  if (!transactionId) {
    res.status(400).json({
      message: "A valid transaction ID is required.",
      code: "INVALID_TRANSACTION_ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid dispute reason is required.",
      code: "INVALID_DISPUTE_INPUT",
    });
    return;
  }

  try {
    const dispute = await openTransactionDispute({
      transactionId,
      actorId: req.currentUser!.id,
      actorRole: req.currentUser!.role,
      reason: parsed.data.reason,
    });

    res.status(201).json({
      message: "Transaction dispute opened successfully.",
      dispute,
    });
  } catch (error) {
    handleDisputeError(error, res);
  }
};

export const listTransactionDisputesController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = disputeListQuerySchema.safeParse(req.query);
  const transactionId = req.params.transactionId;

  if (!transactionId) {
    res.status(400).json({
      message: "A valid transaction ID is required.",
      code: "INVALID_TRANSACTION_ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid dispute filters or pagination values.",
      code: "INVALID_DISPUTE_QUERY",
    });
    return;
  }

  try {
    const disputes = await getTransactionDisputes({
      transactionId,
      userId: req.currentUser!.id,
      userRole: req.currentUser!.role,
      status: parsed.data.status,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    res.status(200).json(disputes);
  } catch (error) {
    handleDisputeError(error, res);
  }
};

export const decideTransactionDisputeController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = disputeDecisionSchema.safeParse(req.body);
  const disputeId = req.params.disputeId;

  if (!disputeId) {
    res.status(400).json({
      message: "A valid dispute ID is required.",
      code: "INVALID_DISPUTE_ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid decision and resolution note are required.",
      code: "INVALID_DISPUTE_DECISION",
    });
    return;
  }

  try {
    const result = await decideTransactionDispute({
      disputeId,
      actorId: req.currentUser!.id,
      actorRole: req.currentUser!.role,
      decision: parsed.data.decision,
      resolutionNote: parsed.data.resolution_note,
    });

    res.status(200).json({
      message: `Transaction dispute ${parsed.data.decision} successfully.`,
      ...result,
    });
  } catch (error) {
    handleDisputeError(error, res);
  }
};

export const openCommissionDisputeController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = disputeSubmissionSchema.safeParse(req.body);
  const commissionId = req.params.commissionId;

  if (!commissionId) {
    res.status(400).json({
      message: "A valid commission ID is required.",
      code: "INVALID_COMMISSION_ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid dispute reason is required.",
      code: "INVALID_DISPUTE_INPUT",
    });
    return;
  }

  try {
    const result = await openCommissionDispute({
      commissionId,
      actorId: req.currentUser!.id,
      reason: parsed.data.reason,
    });

    res.status(201).json({
      message: "Commission dispute opened successfully.",
      ...result,
    });
  } catch (error) {
    handleDisputeError(error, res);
  }
};

// Controller to list commission disputes
export const listCommissionDisputesController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = disputeListQuerySchema.safeParse(req.query);
  const commissionId = req.params.commissionId;

  if (!commissionId) {
    res.status(400).json({
      message: "A valid commission ID is required.",
      code: "INVALID_COMMISSION_ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid dispute filters or pagination values.",
      code: "INVALID_DISPUTE_QUERY",
    });
    return;
  }

  try {
    const disputes = await getCommissionDisputes({
      commissionId,
      userId: req.currentUser!.id,
      userRole: req.currentUser!.role,
      status: parsed.data.status,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    res.status(200).json(disputes);
  } catch (error) {
    handleDisputeError(error, res);
  }
};