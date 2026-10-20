import { Router } from "express";
import {
  registerController,
  verifyEmailController,
  resendVerificationController,
  loginController,
  getMeController,
  refreshController,
  logoutController,
  resetPasswordController,
  requestPasswordResetController,
  updateProfileController,

} from "../controllers/authController";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post ("/verify-email",verifyEmailController)
router.post(
  "/resend-verification",
  resendVerificationController
);
router.get("/me", authenticate, getMeController);
router.patch("/me", authenticate, updateProfileController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);

router.post("/forgot-password", requestPasswordResetController);
router.post("/reset-password", resetPasswordController);


export default router;
