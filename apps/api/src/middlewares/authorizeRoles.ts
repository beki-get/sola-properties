
import type { RequestHandler } from "express";
import type { AppRole } from "../queries/authQueries";

export function authorizeRoles(
  ...allowedRoles: AppRole[]
): RequestHandler {
  return (req, res, next) => {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.currentUser.role)) {
      res.status(403).json({
        message: "You do not have permission to access this resource",
        code: "INSUFFICIENT_ROLE",
      });
      return;
    }

    next();
  };
}
