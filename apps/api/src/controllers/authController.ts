import type { Request, Response } from "express";
import { logger } from "../utils/logger";
import {
  AuthServiceError,
  register,
  verifyEmail,
  resendVerification,
  login,
  getCurrentUser,
  refreshSession,
  logout,
  requestPasswordReset,
  resetPassword,
  updateProfile,
} from "../services/authService";

const REFRESH_COOKIE_NAME = "sola_refresh_token";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearRefreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
};

function getRefreshCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();

    if (name === REFRESH_COOKIE_NAME) {
      return part.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
}

//register controller
export async function registerController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await register(req.body);

    res.status(201).json({
      message: result.verificationEmailSent
        ? "Registration successful. Check your email to verify your account."
        : "Registration successful, but the verification email could not be sent. Please request another verification email later.",
      data: result.user,
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      const status =
        error.code === "VALIDATION_ERROR"
          ? 400
          : error.code === "EMAIL_ALREADY_REGISTERED"
            ? 409
            : 400;

      res.status(status).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    logger.error({ err: error }, "Registration failed");

    res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//login controller
export async function loginController(req: Request, res: Response) {
  try {
    const result = await login(req.body, {
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    const { refreshToken: _refreshToken, ...publicResult } = result;

    return res.status(200).json({
      message: "Login successful",
      data: publicResult,
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      switch (error.code) {
        case "VALIDATION_ERROR":
          return res.status(400).json({ message: error.message });

        case "INVALID_CREDENTIALS":
          return res.status(401).json({ message: error.message });

        case "EMAIL_NOT_VERIFIED":
        case "ACCOUNT_NOT_APPROVED":
          return res.status(403).json({ message: error.message });
      }
    }

    logger.error({ err: error }, "Login failed unexpectedly");

    return res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//email verification controller
export async function verifyEmailController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = await verifyEmail(req.body);

    res.status(200).json({
      message: "Email verified successfully",
      data: user,
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      res.status(400).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    logger.error({ err: error }, "Email verification failed");

    res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//resend verification controller
export async function resendVerificationController(
  req: Request,
  res: Response,
) {
  try {
    await resendVerification(req.body);

    return res.status(200).json({
      message:
        "If an unverified account exists for that email, a verification email will be sent.",
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      return res.status(400).json({
        message: error.message,
      });
    }

    logger.error(
      { err: error },
      "Failed to process verification resend request",
    );

    return res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

// Get current user controller
export async function getMeController(req: Request, res: Response) {
  if (!req.currentUser) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  return res.status(200).json({
    message: "User retrieved successfully",
    data: req.currentUser,
  });
}

//refresh controller
export async function refreshController(req: Request, res: Response) {
  const rawToken = getRefreshCookie(req);

  if (!rawToken) {
    return res.status(401).json({
      message: "Refresh token required",
    });
  }

  try {
    const result = await refreshSession(rawToken, {
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    return res.status(200).json({
      message: "Token refreshed successfully",
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error: unknown) {
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);

    if (error instanceof AuthServiceError) {
      if (error.code === "ACCOUNT_NOT_APPROVED") {
        return res.status(403).json({
          message: error.message,
        });
      }

      if (
        error.code === "INVALID_REFRESH_TOKEN" ||
        error.code === "REFRESH_TOKEN_REUSE"
      ) {
        return res.status(401).json({
          message: error.message,
        });
      }
    }

    logger.error({ err: error }, "Refresh token operation failed");

    return res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//logout controller
export async function logoutController(req: Request, res: Response) {
  try {
    const rawToken = getRefreshCookie(req);

    await logout(rawToken);

    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Logout failed");

    // Clear the browser cookie even if revocation fails.
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);

    return res.status(500).json({
      message: "Unable to complete logout. Please try again.",
    });
  }
}

//forgot password controller
export async function requestPasswordResetController(
  req: Request,
  res: Response,
) {
  try {
    await requestPasswordReset(req.body);

    return res.status(200).json({
      message:
        "If an eligible account exists for that email, password-reset instructions will be sent.",
    });
  } catch (error: unknown) {
    if (
      error instanceof AuthServiceError &&
      error.code === "VALIDATION_ERROR"
    ) {
      return res.status(400).json({
        message: error.message,
        code: error.code,
      });
    }

    logger.error({ err: error }, "Failed to process password-reset request");

    return res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//reset controller
export async function resetPasswordController(req: Request, res: Response) {
  try {
    await resetPassword(req.body);

    return res.status(200).json({
      message:
        "Password reset successfully. Please log in with your new password.",
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      if (error.code === "VALIDATION_ERROR") {
        return res.status(400).json({
          message: error.message,
          code: error.code,
        });
      }

      if (error.code === "INVALID_PASSWORD_RESET_TOKEN") {
        return res.status(400).json({
          message: error.message,
          code: error.code,
        });
      }
    }

    logger.error({ err: error }, "Password reset failed");

    return res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}

//update profile controller 

export async function updateProfileController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const result = await updateProfile(
      req.currentUser.id,
      req.body,
    );

    res.status(200).json({
      message: result.verificationEmailSent
        ? "Profile updated successfully"
        : "Profile updated, but verification email delivery failed. Please request another verification email.",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) {
      const status =
        error.code === "VALIDATION_ERROR" ? 400 :
        error.code === "EMAIL_ALREADY_EXISTS" ? 409 :
        error.code === "USER_NOT_FOUND" ? 404 :
        400;

      res.status(status).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
}