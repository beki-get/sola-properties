import type { Request, Response, NextFunction } from "express";
import {
  createCommissionAgreementSchema,
  commissionIdSchema,
  getCommissionsSchema,
  recordCommissionPaymentSchema,
  createCommissionAdjustmentSchema,
} from "../schemas/commissionAgreementSchemas";
import { CommissionAgreementError } from "../queries/commissionAgreementQueries";
import {
  createCommissionAgreementService,
  getCommissionAgreementsService,
  getCommissionsService,
  getCommissionStatementService,
  approveCommissionService,
  recordCommissionPaymentService,
  createCommissionAdjustment as createAdjustment,
} from "../services/commissionAgreementService";
import { paginationSchema } from "../utils/pagination";
export async function createCommissionAgreementController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createCommissionAgreementSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid commission agreement data.",
        code: "VALIDATION_ERROR",
      });
    }

    const agreement = await createCommissionAgreementService({
      ...parsed.data,
      actorId: req.currentUser!.id,
    });

    return res.status(201).json({
      message: "Commission agreement created successfully.",
      data: agreement,
    });
  } catch (error) {
    if (error instanceof CommissionAgreementError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}

export async function getCommissionAgreementsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = paginationSchema.strict().safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid pagination parameters.",
        code: "VALIDATION_ERROR",
      });
    }

    const { page, limit } = parsed.data;
    const role = req.currentUser!.role;
    const sellerId =
      role === "admin" || role === "finance_admin"
        ? undefined
        : req.currentUser!.id;

    const result = await getCommissionAgreementsService({
      sellerId,
      page,
      limit,
    });

    return res.status(200).json({
      message: "Commission agreements retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCommissionsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = getCommissionsSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid commission query parameters.",
        code: "VALIDATION_ERROR",
      });
    }

    const role = req.currentUser!.role;
    const isStaff = role === "admin" || role === "finance_admin";

    if (!isStaff && parsed.data.sellerId) {
      return res.status(403).json({
        message: "You can only retrieve your own commission records.",
        code: "FORBIDDEN",
      });
    }

    const result = await getCommissionsService({
      ...parsed.data,
      sellerId: isStaff ? parsed.data.sellerId : req.currentUser!.id,
    });

    return res.status(200).json({
      message: "Commissions retrieved successfully.",
      data: result.items,
      summary: result.summary,
      pagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / parsed.data.limit),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCommissionStatementController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = commissionIdSchema.safeParse(req.params);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid commission ID.",
        code: "VALIDATION_ERROR",
      });
    }

    const role = req.currentUser!.role;
    const isStaff = role === "admin" || role === "finance_admin";

    const statement = await getCommissionStatementService(
      parsed.data.id,
      isStaff ? undefined : req.currentUser!.id,
    );

    if (!statement) {
      return res.status(404).json({
        message: "Commission not found.",
        code: "COMMISSION_NOT_FOUND",
      });
    }

    return res.status(200).json({
      message: "Commission statement retrieved successfully.",
      data: statement,
    });
  } catch (error) {
    return next(error);
  }
}

export async function approveCommissionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = commissionIdSchema.safeParse(req.params);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid commission ID.",
        code: "VALIDATION_ERROR",
      });
    }

    const commission = await approveCommissionService(
      parsed.data.id,
      req.currentUser!.id,
    );

    return res.status(200).json({
      message: "Commission approved successfully.",
      data: commission,
    });
  } catch (error) {
    if (error instanceof CommissionAgreementError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}

export async function recordCommissionPaymentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = commissionIdSchema.safeParse(req.params);

    if (!params.success) {
      return res.status(400).json({
        message: "Invalid commission ID.",
        code: "VALIDATION_ERROR",
      });
    }

    const body = recordCommissionPaymentSchema.safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({
        message: "Invalid commission payment data.",
        code: "VALIDATION_ERROR",
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (body.data.paidOn > today) {
      return res.status(400).json({
        message: "Payment date cannot be in the future.",
        code: "INVALID_PAYMENT_DATE",
      });
    }

    const result = await recordCommissionPaymentService({
      commissionId: params.data.id,
      ...body.data,
      actorId: req.currentUser!.id,
    });

    return res.status(201).json({
      message: "Commission payment recorded successfully.",
      data: result,
    });
  } catch (error) {
    if (error instanceof CommissionAgreementError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}

export async function createCommissionAdjustmentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = commissionIdSchema.safeParse(req.params);

    if (!params.success) {
      return res.status(400).json({
        message: "Invalid commission ID.",
        code: "VALIDATION_ERROR",
      });
    }

    const parsed = createCommissionAdjustmentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid commission adjustment data.",
        code: "VALIDATION_ERROR",
      });
    }

    const result = await createAdjustment(
      params.data.id,
      req.currentUser!.id,
      parsed.data.amount,
      parsed.data.reason,
    );

    return res.status(201).json({
      message: "Commission adjustment recorded successfully.",
      data: result,
    });
  } catch (error) {
    if (error instanceof CommissionAgreementError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}
