import { Router } from "express";
import { getMyBuyerPreferences, patchMyBuyerPreferences, putMyBuyerPreferences } from "../controllers/buyerPreferencesController";
import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

router.use(authenticate, authorizeRoles("buyer"));

router.get("/me/preferences", getMyBuyerPreferences);
router.put("/me/preferences", putMyBuyerPreferences);
router.patch("/me/preferences", patchMyBuyerPreferences);

export default router;