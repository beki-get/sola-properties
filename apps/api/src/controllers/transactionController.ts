import type { RequestHandler } from "express";
import { TransactionError } from "../queries/transactionQueries";
import {
  createTransaction,
  decideTransaction,
  getTransactionDetail,
  getTransactionDocumentList,
  getTransactions,
  updateTransaction,
  uploadTransactionDocuments,
} from "../services/transactionService";
import {
  transactionDecisionSchema,
  transactionListQuerySchema,
  transactionSubmissionSchema,
  transactionUpdateSchema,
} from "../schemas/transactionSchemas";

function handleTransactionError(
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

export const createTransactionController: RequestHandler = async (req, res) => {
  const parsed = transactionSubmissionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid referralId, sale_amount, and closing_date are required.",
      code: "INVALID_TRANSACTION_INPUT",
    });
    return;
  }

  try {
    const transaction = await createTransaction({
      sellerId: req.currentUser!.id,
      referralId: parsed.data.referralId,
      saleAmount: parsed.data.sale_amount,
      closingDate: parsed.data.closing_date,
      notes: parsed.data.notes ?? null,
    });

    res.status(201).json({
      message: "Transaction submitted successfully.",
      transaction,
    });
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const listTransactionsController: RequestHandler = async (req, res) => {
  const parsed = transactionListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid transaction filter or pagination values.",
      code: "INVALID_TRANSACTION_QUERY",
    });
    return;
  }

  try {
    const transactions = await getTransactions({
      userId: req.currentUser!.id,
      userRole: req.currentUser!.role,
      status: parsed.data.status,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    res.status(200).json(transactions);
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const getTransactionController: RequestHandler = async (req, res) => {
  const transactionId = req.params.transactionId;

  if (!transactionId) {
    res.status(400).json({
      message: "A valid transaction ID is required.",
      code: "INVALID_TRANSACTION_ID",
    });
    return;
  }

  try {
    const transaction = await getTransactionDetail({
      transactionId,
      userId: req.currentUser!.id,
      userRole: req.currentUser!.role,
    });

    res.status(200).json({ transaction });
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const updateTransactionController: RequestHandler = async (req, res) => {
  const parsed = transactionUpdateSchema.safeParse(req.body);
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
      message: "Provide a valid field to update.",
      code: "INVALID_TRANSACTION_UPDATE",
    });
    return;
  }

  try {
    const transaction = await updateTransaction({
      transactionId,
      sellerId: req.currentUser!.id,
      saleAmount: parsed.data.sale_amount,
      closingDate: parsed.data.closing_date,
      notes: parsed.data.notes,
    });

    res.status(200).json({
      message: "Transaction updated successfully.",
      transaction,
    });
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const getTransactionDocumentsController: RequestHandler = async (
  req,
  res,
) => {
  const transactionId = req.params.transactionId;

  if (!transactionId) {
    res.status(400).json({
      message: "A valid transaction ID is required.",
      code: "INVALID_TRANSACTION_ID",
    });
    return;
  }

  try {
    const transaction = await getTransactionDetail({
      transactionId,
      userId: req.currentUser!.id,
      userRole: req.currentUser!.role,
    });

    const documents = await getTransactionDocumentList(transaction.id);

    res.status(200).json({
      transactionId: transaction.id,
      documents,
    });
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const uploadTransactionDocumentsController: RequestHandler = async (
  req,
  res,
) => {
  const transactionId = req.params.transactionId;
  const files = (req.files ?? []) as Express.Multer.File[];

  if (!transactionId) {
    res.status(400).json({
      message: "A valid transaction ID is required.",
      code: "INVALID_TRANSACTION_ID",
    });
    return;
  }

  if (files.length === 0) {
    res.status(400).json({
      message: "Upload at least one supporting document.",
      code: "DOCUMENTS_REQUIRED",
    });
    return;
  }

  try {
    const documents = await uploadTransactionDocuments({
      transactionId,
      sellerId: req.currentUser!.id,
      files: files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
    });

    res.status(201).json({
      message: "Transaction documents uploaded successfully.",
      documents,
    });
  } catch (error) {
    handleTransactionError(error, res);
  }
};

export const decideTransactionController: RequestHandler = async (req, res) => {
  const parsed = transactionDecisionSchema.safeParse(req.body);
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
      message: "A valid decision is required. Rejections require a reason.",
      code: "INVALID_TRANSACTION_DECISION",
    });
    return;
  }

  if (req.currentUser!.role !== "admin" && req.currentUser!.role !== "finance_admin") {
    res.status(403).json({
      message: "Only admin or finance users can verify or reject a transaction.",
      code: "TRANSACTION_DECISION_NOT_ALLOWED",
    });
    return;
  }

  try {
    const transaction = await decideTransaction({
      transactionId,
      actorId: req.currentUser!.id,
      actorRole: req.currentUser!.role,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
    });

    res.status(200).json({
      message:
        parsed.data.decision === "verified"
          ? "Transaction verified successfully."
          : "Transaction rejected successfully.",
      transaction,
    });
  } catch (error) {
    handleTransactionError(error, res);
  }
};
