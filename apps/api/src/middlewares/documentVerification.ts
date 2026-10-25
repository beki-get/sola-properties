
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import type { RequestHandler } from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024,
  },
});

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const uploadVerificationDocuments: RequestHandler = (
  req,
  res,
  next,
) => {
  upload.array("documents", 3)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";

      res.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? "Each document must be 5 MB or smaller"
          : "Invalid document upload. Maximum 3 documents are allowed.",
        code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_DOCUMENT_UPLOAD",
      });
      return;
    }

    if (error) {
      next(error);
      return;
    }

    void (async () => {
      const files = (req.files ?? []) as Express.Multer.File[];

      for (const file of files) {
        const detectedType = await fileTypeFromBuffer(file.buffer);

        if (!detectedType || !allowedTypes.has(detectedType.mime)) {
          res.status(400).json({
            message: "Only PDF, JPEG, and PNG documents are allowed",
            code: "INVALID_DOCUMENT_TYPE",
          });
          return;
        }
        file.mimetype = detectedType.mime;
      }

      next();
    })().catch(next);
  });
};
