import type { RequestHandler } from "express";
import type { AccessTokenPayload } from "../utils/jwt";
import { verifyAccessToken } from "../utils/jwt";
import { findUserById } from "../queries/authQueries";
import type { AppRole } from "../queries/authQueries";

export type AccountStatus =
  "pending" | "approved" | "rejected" | "suspended" | "deactivated";

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  status: AccountStatus;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      currentUser?: AuthenticatedUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, res, next) => {
  const authorization = req.get("authorization");

  if (!authorization) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  const [scheme, token, ...extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra.length > 0) {
    res.status(401).json({
      message: "Invalid authorization header",
    });
    return;
  }

  let payload: AccessTokenPayload;

  try {
    payload = await verifyAccessToken(token);
  } catch {
    res.status(401).json({
      message: "Invalid or expired access token",
    });
    return;
  }

  try {
    const user = await findUserById(payload.userId);

    if (!user) {
      res.status(401).json({
        message: "User account no longer exists",
      });
      return;
    }

    if (!user.email_verified_at) {
      res.status(403).json({
        message: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }

    if (user.status === "suspended" || user.status === "deactivated") {
      res.status(403).json({
        message: "Your account is not active",
        code: "ACCOUNT_INACTIVE",
        status: user.status,
      });
      return;
    }

    req.auth = {
      userId: user.id,
      role: user.role,
    };

    req.currentUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: true,
    };

    next();
  } catch (error) {
    next(error);
  }
};
