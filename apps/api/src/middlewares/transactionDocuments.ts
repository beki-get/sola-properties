import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import type { RequestHandler } from "express";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },
});

export const uploadTransactionDocuments: RequestHandler = (req, res, next) => {
  upload.array("documents", MAX_FILES)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? "Each document must be 5 MB or smaller"
          : `Invalid upload. Maximum ${MAX_FILES} documents are allowed.`,
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

      if (files.length === 0) {
        res.status(400).json({
          message: "Upload at least one supporting document.",
          code: "DOCUMENTS_REQUIRED",
        });
        return;
      }

      for (const file of files) {
        const detected = await fileTypeFromBuffer(file.buffer);

        if (!detected || !allowedTypes.has(detected.mime)) {
          res.status(400).json({
            message: "Only PDF, JPG, PNG, and WebP documents are allowed.",
            code: "INVALID_DOCUMENT_TYPE",
          });
          return;
        }

        file.mimetype = detected.mime;
      }

      next();
    })().catch(next);
  });
};
