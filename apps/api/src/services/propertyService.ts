import {
  createProperty as insertProperty,
  listMyProperties as queryMyProperties,
  getMyProperty as queryMyProperty,
  updateMyProperty as queryUpdateMyProperty,
  changeMyPropertyStatus as queryChangePropertyStatus,
  listPublicProperties as queryPublicProperties,
  getPublicProperty as queryPublicProperty,
  comparePublicProperties as queryCompareProperties,
  listRecommendedProperties as queryRecommendedProperties,
  getAdminPendingProperties as queryAdminPendingProperties,
  getAdminPendingProperty as queryAdminPendingProperty,
  decideAdminProperty as queryDecideAdminProperty,
  getMyPropertyHistory as queryGetMyPropertyHistory,
} from "../queries/propertyQueries";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyListQuery,
  PublicPropertyListQuery,
  AdminPendingPropertyListQuery,
  AdminPropertyDecisionInput,
} from "../schemas/propertySchemas";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { s3 } from "../config/s3Client";
import type { NewPropertyImage } from "../queries/propertyQueries";
import {
  insertPropertyImages,
  listPropertyImages,
  deletePropertyImageMetadata,
} from "../queries/propertyQueries";

type PropertyOwnerRole = "agent" | "developer";

export async function createProperty(
  ownerId: string,
  role: PropertyOwnerRole,
  input: CreatePropertyInput,
) {
  return insertProperty(ownerId, role, input);
}

export async function getMyProperties(
  ownerId: string,
  query: PropertyListQuery,
) {
  return queryMyProperties(ownerId, query);
}

export async function getMyProperty(ownerId: string, propertyId: string) {
  return queryMyProperty(ownerId, propertyId);
}

export async function updateProperty(
  ownerId: string,
  role: PropertyOwnerRole,
  propertyId: string,
  input: UpdatePropertyInput,
) {
  return queryUpdateMyProperty(ownerId, role, propertyId, input);
}

export async function updatePropertyStatus(
  ownerId: string,
  propertyId: string,
  status: "inactive" | "sold",
) {
  return queryChangePropertyStatus(ownerId, propertyId, status);
}

const propertyImagesBucket = process.env.NEON_PROPERTY_IMAGES_BUCKET;

function requirePropertyImagesBucket(): string {
  if (!propertyImagesBucket) {
    throw new Error("NEON_PROPERTY_IMAGES_BUCKET is not configured");
  }

  return propertyImagesBucket;
}

const extensionByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

type UploadedImage = {
  buffer: Buffer;
  originalname: string;
  mimetype: "image/jpeg" | "image/png" | "image/webp";
  size: number;
};

async function deleteUploadedObjects(keys: string[]) {
  const bucket = requirePropertyImagesBucket();

  const results = await Promise.allSettled(
    keys.map((Key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key,
        }),
      ),
    ),
  );

  const failed = results.filter((result) => result.status === "rejected");

  if (failed.length > 0) {
    console.error(
      `Failed to clean up ${failed.length} property image object(s)`,
    );
  }
}

async function signPropertyImage<T extends { storage_key: string }>(image: T) {
  const bucket = requirePropertyImagesBucket();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: image.storage_key,
    }),
    { expiresIn: 3600 },
  );

  // Never expose the private storage key to API clients.
  const { storage_key: _storageKey, ...metadata } = image;
  return { ...metadata, url };
}

export async function uploadPropertyImages(
  ownerId: string,
  propertyId: string,
  files: UploadedImage[],
) {
  const bucket = requirePropertyImagesBucket();
  const uploadedKeys: string[] = [];
  const metadata: NewPropertyImage[] = [];

  try {
    for (const file of files) {
      const extension = extensionByMime[file.mimetype];
      const key = `${propertyId}/${randomUUID()}${extension}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      uploadedKeys.push(key);

      metadata.push({
        storageKey: key,
        originalFilename: basename(file.originalname).slice(0, 255),
        mimeType: file.mimetype,
        fileSize: file.size,
      });
    }

    const images = await insertPropertyImages(ownerId, propertyId, metadata);

    return await Promise.all(images.map(signPropertyImage));
  } catch (error) {
    await deleteUploadedObjects(uploadedKeys);
    throw error;
  }
}

export async function getPropertyImages(ownerId: string, propertyId: string) {
  const images = await listPropertyImages(ownerId, propertyId);
  return Promise.all(images.map(signPropertyImage));
}

export async function deletePropertyImage(
  ownerId: string,
  propertyId: string,
  imageId: string,
) {
  // Delete metadata transactionally first. If object deletion fails,
  // the API can report that cleanup needs attention without exposing
  // a database record pointing to a deleted object.
  const image = await deletePropertyImageMetadata(ownerId, propertyId, imageId);

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: requirePropertyImagesBucket(),
        Key: image.storage_key,
      }),
    );

    return { deleted: true, cleanupPending: false };
  } catch (error) {
    console.error("Property image object cleanup failed", {
      propertyId,
      imageId,
      error,
    });

    return { deleted: true, cleanupPending: true };
  }
}

export async function listPublicProperties(query: PublicPropertyListQuery) {
  return queryPublicProperties(query);
}

export async function getPublicProperty(propertyId: string) {
  return queryPublicProperty(propertyId);
}

export async function comparePublicProperties(ids: string[]) {
  return queryCompareProperties(ids);
}

export async function listRecommendedProperties(userId: string) {
  return queryRecommendedProperties(userId);
}

//admin functions for property approval
export async function getAdminPendingProperties(
  query: AdminPendingPropertyListQuery,
) {
  return queryAdminPendingProperties(query);
}

export async function getAdminPendingProperty(propertyId: string) {
  return queryAdminPendingProperty(propertyId);
}

export async function decideAdminProperty(
  propertyId: string,
  adminId: string,
  input: AdminPropertyDecisionInput,
) {
  return queryDecideAdminProperty(propertyId, adminId, input);
}

//property history
export async function getMyPropertyHistoryService(
  ownerId: string,
  propertyId: string,
) {
  return queryGetMyPropertyHistory(ownerId, propertyId);
}
