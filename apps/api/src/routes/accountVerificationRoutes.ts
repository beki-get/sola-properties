
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  getMyVerificationRequests,
  submitVerification,
} from "../controllers/accountVerificationController";

const router = Router();

router.use(authenticate);

router.post("/", submitVerification);
router.get("/me", getMyVerificationRequests);

export default router;
