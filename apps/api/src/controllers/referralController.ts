import type { RequestHandler } from "express";
import type { Request, Response, NextFunction } from "express";
import { ReferralError } from "../queries/referralQueries";
import {
  createReferral,
  getMyReferrals,
  respondToReferral,
  updateReferralStatus,
  reassignReferralService,
  getAllReferralsService,
  getReferralDetailsService,
  getReferralHistoryService,
  getBuyerReferralsService,
  createReferralFollowUpService,
  getReferralFollowUpsService,
  createReferralMessageService,
  getReferralMessagesService,
  createReferralIssueService,
  getMyReferralIssuesService,
  getAdminReferralIssuesService,
  getAdminReferralIssueByIdService,
  updateReferralIssueService,
} from "../services/referralService";
import {
  createReferralSchema,
  referralDecisionSchema,
  referralStatusSchema,
  reassignReferralSchema,
  adminReferralFilterSchema,
  createFollowUpSchema,
  referralIdSchema,
  createReferralMessageSchema,
} from "../schemas/referralSchemas";

import {
  createReferralIssueSchema,
  updateReferralIssueSchema,
} from "../schemas/referralIssueSchemas";

import { paginationSchema } from "../utils/pagination.js";

export const createReferralController: RequestHandler = async (req, res) => {
  const parsed = createReferralSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid propertyId and optional message are required.",
      code: "INVALID REFERRAL INPUT",
    });
    return;
  }

  try {
    const referral = await createReferral({
      buyerId: req.currentUser!.id,
      propertyId: parsed.data.propertyId,
      message: parsed.data.message,
    });

    res.status(201).json({
      message: "Inquiry submitted successfully.",
      referral,
    });
  } catch (error) {
    if (error instanceof ReferralError) {
      res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL SERVER ERROR",
    });
  }
};

//retrieve referrals for owner

export const getMyReferralsController: RequestHandler = async (req, res) => {
  try {
    const referrals = await getMyReferrals(req.currentUser!.id);
    res.status(200).json({ referrals });
  } catch {
    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL SERVER ERROR",
    });
  }
};

//accept or reject referrals
export const respondToReferralController: RequestHandler = async (req, res) => {
  const parsed = referralDecisionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message:
        "A valid decision is required; rejection also requires a reason.",
      code: "INVALID REFERRAL DECISION",
    });
    return;
  }

  try {
    const referral = await respondToReferral({
      referralId: req.params.referralId as string,
      actorId: req.currentUser!.id,
      ...parsed.data,
    });
    res.status(200).json({ referral });
  } catch (error) {
    req.log.error({ err: error }, "Failed to respond to referral");

    if (error instanceof ReferralError) {
      res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL SERVER ERROR",
    });
  }
};

//referral status changes
export const updateReferralStatusController: RequestHandler = async (
  req,
  res,
) => {
  const parsed = referralStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message:
        "A valid status is required; closing as lost also requires a reason.",
      code: "INVALID REFERRAL STATUS",
    });
    return;
  }

  try {
    const referral = await updateReferralStatus({
      referralId: req.params.referralId as string,
      actorId: req.currentUser!.id,
      ...parsed.data,
    });
    res.status(200).json({ referral });
  } catch (error) {
    if (error instanceof ReferralError) {
      res
        .status(error.statusCode)
        .json({ message: error.message, code: error.code });
      return;
    }
    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

//reassign referral to another agent
export const reassignReferralController: RequestHandler = async (req, res) => {
  const parsed = reassignReferralSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid newAssigneeId and optional reason are required.",
      code: "INVALID REASSIGNMENT INPUT",
    });
    return;
  }

  try {
    const referral = await reassignReferralService({
      referralId: req.params.referralId as string,
      actorId: req.currentUser!.id,
      newAssigneeId: parsed.data.newAssigneeId,
      reason: parsed.data.reason,
    });

    res.status(200).json({
      message: "Referral reassigned successfully.",
      referral,
    });
  } catch (error) {
    if (error instanceof ReferralError) {
      res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL SERVER ERROR",
    });
  }
};

//get all referrals for admin
export const getAllReferralsController: RequestHandler = async (req, res) => {
  const parsed = adminReferralFilterSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid referral status filter.",
      code: "INVALID_REFERRAL_FILTER",
    });
    return;
  }

  try {
    const referrals = await getAllReferralsService(parsed.data.status);

    res.status(200).json({ referrals });
  } catch {
    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

//get referral details for admin
export const getReferralDetailsController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const referral = await getReferralDetailsService(
      req.params.referralId as string,
    );

    res.status(200).json({ referral });
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

//get referral history for admin
export const getReferralHistoryController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const history = await getReferralHistoryService(
      req.params.referralId as string,
    );

    res.status(200).json({ history });
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

export const getBuyerReferralsController: RequestHandler = async (req, res) => {
  try {
    const referrals = await getBuyerReferralsService(req.currentUser!.id);

    res.status(200).json({ referrals });
  } catch {
    res.status(500).json({
      message: "An unexpected error occurred.",
      code: "INTERNAL SERVER ERROR",
    });
  }
};

//follow-up messages for a referral, visible to the assigned agent/developer
export const createReferralFollowUpController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const validation = createFollowUpSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid follow-up data",
        errors: validation.error.flatten(),
      });
      return;
    }
    const idValidation = referralIdSchema.safeParse(req.params.referralId);

    if (!idValidation.success) {
      res.status(400).json({
        message: "Invalid referral ID",
        code: "INVALID_REFERRAL_ID",
      });
      return;
    }
    const followUp = await createReferralFollowUpService({
      referralId: idValidation.data,
      senderId: req.currentUser!.id,
      body: validation.data.body,
      dueAt: validation.data.dueAt,
    });

    res.status(201).json({
      message: "Follow-up recorded successfully",
      followUp,
    });
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

export const getReferralFollowUpsController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const validation = paginationSchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid pagination parameters",
        errors: validation.error.flatten(),
      });
      return;
    }
    const idValidation = referralIdSchema.safeParse(req.params.referralId);

    if (!idValidation.success) {
      res.status(400).json({
        message: "Invalid referral ID",
        code: "INVALID_REFERRAL_ID",
      });
      return;
    }
    const result = await getReferralFollowUpsService({
      referralId: idValidation.data,
      userId: req.currentUser!.id,
      isAdmin: req.currentUser!.role === "admin",
      page: validation.data.page,
      limit: validation.data.limit,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

// Send a message on a referral.
export const createReferralMessageController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const idValidation = referralIdSchema.safeParse(req.params.referralId);

    if (!idValidation.success) {
      res.status(400).json({
        message: "Invalid referral ID",
        code: "INVALID_REFERRAL_ID",
      });
      return;
    }

    const validation = createReferralMessageSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid message data",
        errors: validation.error.flatten(),
      });
      return;
    }

    const message = await createReferralMessageService({
      referralId: idValidation.data,
      senderId: req.currentUser!.id,
      senderRole: req.currentUser!.role as "buyer" | "agent" | "developer",
      body: validation.data.body,
    });

    res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

// Retrieve referral conversation history.
export const getReferralMessagesController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const idValidation = referralIdSchema.safeParse(req.params.referralId);

    if (!idValidation.success) {
      res.status(400).json({
        message: "Invalid referral ID",
        code: "INVALID_REFERRAL_ID",
      });
      return;
    }

    const validation = paginationSchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid pagination parameters",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await getReferralMessagesService({
      referralId: idValidation.data,
      userId: req.currentUser!.id,
      isAdmin: req.currentUser!.role === "admin",
      page: validation.data.page,
      limit: validation.data.limit,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ReferralError) {
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
};

export async function createReferralIssueController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createReferralIssueSchema.safeParse({
      ...req.body,
      referralId: req.body.referralId,
    });

    if (!parsed.success) {
      throw new ReferralError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid report data",
      );
    }

    const role = req.currentUser!.role;

    if (!["buyer", "agent", "developer"].includes(role)) {
      throw new ReferralError(
        403,
        "ROLE_NOT_ALLOWED",
        "You are not allowed to submit referral issue reports",
      );
    }

    const issue = await createReferralIssueService({
      ...parsed.data,
      reportedBy: req.currentUser!.id,
      reporterRole: role as "buyer" | "agent" | "developer",
    });

    res.status(201).json({
      message: "Referral issue reported successfully",
      data: issue,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyReferralIssuesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = paginationSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ReferralError(
        400,
        "VALIDATION_ERROR",
        "Invalid pagination parameters",
      );
    }

    const result = await getMyReferralIssuesService({
      userId: req.currentUser!.id,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    res.status(200).json({
      message: "Your referral issue reports retrieved successfully",
      data: result.issues,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminReferralIssuesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = paginationSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ReferralError(
        400,
        "VALIDATION_ERROR",
        "Invalid pagination parameters",
      );
    }

    const status = req.query.status;

    const allowedStatuses = ["open", "under_review", "resolved", "dismissed"];

    if (
      status !== undefined &&
      (typeof status !== "string" || !allowedStatuses.includes(status))
    ) {
      throw new ReferralError(
        400,
        "INVALID_ISSUE_STATUS",
        "Invalid referral issue status",
      );
    }

    const result = await getAdminReferralIssuesService({
      page: parsed.data.page,
      limit: parsed.data.limit,
      status: status as string | undefined,
    });

    res.status(200).json({
      message: "Referral issue reports retrieved successfully",
      data: result.issues,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminReferralIssueByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = referralIdSchema.safeParse(req.params.issueId);

    if (!parsed.success) {
      throw new ReferralError(400, "VALIDATION_ERROR", "Invalid report ID");
    }

    const issue = await getAdminReferralIssueByIdService(parsed.data);

    res.status(200).json({
      message: "Referral issue report retrieved successfully",
      data: issue,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReferralIssueController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsedId = referralIdSchema.safeParse(req.params.issueId);

    if (!parsedId.success) {
      throw new ReferralError(400, "VALIDATION_ERROR", "Invalid report ID");
    }

    const parsedBody = updateReferralIssueSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new ReferralError(
        400,
        "VALIDATION_ERROR",
        parsedBody.error.issues[0]?.message ?? "Invalid update data",
      );
    }

    const issue = await updateReferralIssueService({
      issueId: parsedId.data,
      adminId: req.currentUser!.id,
      ...parsedBody.data,
    });

    res.status(200).json({
      message: "Referral issue report updated successfully",
      data: issue,
    });
  } catch (error) {
    next(error);
  }
}
