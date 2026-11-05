import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import type { RequestHandler } from "express";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },
});

export const uploadPropertyImages: RequestHandler = (req, res, next) => {
  upload.array("images", MAX_FILES)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";

      res.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? "Each image must be 5 MB or smaller"
          : `Invalid image upload. Maximum ${MAX_FILES} images are allowed.`,
        code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_IMAGE_UPLOAD",
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
          message: "Upload at least one image",
          code: "IMAGES_REQUIRED",
        });
        return;
      }

      for (const file of files) {
        const detected = await fileTypeFromBuffer(file.buffer);

        if (!detected || !allowedTypes.has(detected.mime)) {
          res.status(400).json({
            message: "Only JPEG, PNG, and WebP images are allowed",
            code: "INVALID_IMAGE_TYPE",
          });
          return;
        }

        file.mimetype = detected.mime;
      }

      next();
    })().catch(next);
  });
};
