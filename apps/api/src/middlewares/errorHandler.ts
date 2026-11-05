import type { ErrorRequestHandler } from "express";
import { logger } from "../utils/logger";

type CustomHttpError = Error & {
  statusCode?: number;
  code?: string;
};

function isCustomHttpError(error: unknown): error is CustomHttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (isCustomHttpError(error)) {
    return res.status(error.statusCode!).json({
      message: error.message,
      code: error.code!,
    });
  }

  logger.error({ err: error }, "Unhandled API error");

  return res.status(500).json({
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
};
