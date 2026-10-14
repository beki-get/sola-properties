
import type { RequestHandler } from "express";

export const requireApprovedAccount: RequestHandler = (
  req,
  res,
  next,
) => {
  if (!req.currentUser) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  if (req.currentUser.status !== "approved") {
    res.status(403).json({
      message: "Your account is not approved for this feature",
      code: "ACCOUNT_NOT_APPROVED",
      status: req.currentUser.status,
    });
    return;
  }

  next();
};
