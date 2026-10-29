import { Router } from "express";
import {
  createPropertyController,
  getMyPropertiesController,
  getMyPropertyController,
  updatePropertyController,
  updatePropertyStatusController,
  uploadPropertyImagesController,
  getPropertyImagesController,
  deletePropertyImageController,
  listPublicPropertiesController,
  getPublicPropertyController,
  comparePropertiesController,
  recommendedPropertiesController,
  getMyPropertyHistoryController,
} from "../controllers/propertyController";

import { authenticate } from "../middlewares/authenticate";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { requireApprovedAccount } from "../middlewares/requireApprovedAccount";
import { uploadPropertyImages } from "../middlewares/propertyImages";

const router = Router();
// Public property routes
router.get("/", listPublicPropertiesController);
router.get("/compare", comparePropertiesController);
router.get(
  "/recommended",
  authenticate,
  authorizeRoles("buyer"),
  requireApprovedAccount,
  recommendedPropertiesController,
);

// Public property routes
router.get("/:propertyId", getPublicPropertyController);

router.use(
  authenticate,
  authorizeRoles("agent", "developer"),
  requireApprovedAccount,
);

// Private property routes
router.post("/", createPropertyController); //create property
router.get("/me", getMyPropertiesController); //get my all properties

router.post(
  "/:propertyId/images",
  uploadPropertyImages,
  uploadPropertyImagesController,
); //create property images

router.get("/:propertyId/images", getPropertyImagesController); //get property images

router.delete("/:propertyId/images/:imageId", deletePropertyImageController); //delete property image

router.get("/:propertyId", getMyPropertyController); //get property by id
router.patch("/:propertyId", updatePropertyController); //update property
router.patch("/:propertyId/status", updatePropertyStatusController); //update property status
router.get("/:propertyId/history", getMyPropertyHistoryController);//get owner property history

export default router;
