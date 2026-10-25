
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  getMyVerificationRequests,
  submitVerification,
} from "../controllers/accountVerificationController";
import { uploadVerificationDocuments } from "../middlewares/documentVerification";

const router = Router();

router.use(authenticate);

router.post("/", uploadVerificationDocuments, submitVerification);
router.get("/me", getMyVerificationRequests);

export default router;
