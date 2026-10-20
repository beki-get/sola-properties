
import type { RequestHandler } from "express";
import {
  AccountVerificationError,
  getMyVerificationHistory,
  submitVerificationRequest,
} from "../services/accountVerificationService";

export const submitVerification: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const request = await submitVerificationRequest(
      req.currentUser.id,
      req.body,
    );

    res.status(201).json({
      message: "Verification application submitted successfully",
      request,
    });
  } catch (error: unknown) {
    if (error instanceof AccountVerificationError) {
      res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    next(error);
  }
};

export const getMyVerificationRequests: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const requests = await getMyVerificationHistory(req.currentUser.id);

    res.status(200).json({ requests });
  } catch (error: unknown) {
    next(error);
  }
};
