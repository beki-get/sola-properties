import type { RequestHandler } from "express";
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
} from "../services/referralService";
import {
  createReferralSchema,
  referralDecisionSchema,
  referralStatusSchema,
  reassignReferralSchema,
  adminReferralFilterSchema,
  createFollowUpSchema,
  referralIdSchema,
} from "../schemas/referralSchemas";
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
