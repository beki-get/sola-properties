import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount.js";
import {
  addFavoriteController,
  getBuyerFavoritesController,
  removeFavoriteController,
} from "../controllers/favoriteController.js";

const router = Router();

router.use(authenticate,authorizeRoles("buyer"),requireApprovedAccount);

router.post("/", addFavoriteController);
router.get("/", getBuyerFavoritesController);
router.delete("/:propertyId", removeFavoriteController);

export default router;