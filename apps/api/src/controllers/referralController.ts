import type { RequestHandler } from "express";
import { ReferralError } from "../queries/referralQueries";
import {
  createReferral,
  getMyReferrals,
  respondToReferral,
  updateReferralStatus,
} from "../services/referralService";
import {
  createReferralSchema,
  referralDecisionSchema,
  referralStatusSchema,
} from "../schemas/referralSchemas";

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
