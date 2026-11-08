import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { s3 } from "../config/s3Client";
import {
  createTransaction as insertTransaction,
  createTransactionDocument as insertTransactionDocument,
  decideTransaction as reviewTransaction,
  getTransactionById as fetchTransaction,
  listTransactionDocuments,
  listTransactions as fetchTransactions,
  updateTransaction as editTransaction,
} from "../queries/transactionQueries";
import { logger } from "../utils/logger";
import { notifyUser } from "./notificationService";
import { pool } from "../config/database";

const transactionDocumentsBucket =
  process.env.NEON_TRANSACTION_DOCUMENTS_BUCKET;

function requireTransactionDocumentsBucket() {
  if (!transactionDocumentsBucket) {
    throw new Error("NEON_TRANSACTION_DOCUMENTS_BUCKET is not configured");
  }

  return transactionDocumentsBucket;
}

const extByMime = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export type UploadedTransactionDocument = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

async function signTransactionDocument<T extends { file_key: string }>(doc: T) {
  const bucket = requireTransactionDocumentsBucket();
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: doc.file_key,
    }),
    { expiresIn: 3600 },
  );

  const { file_key: _fileKey, ...metadata } = doc;
  return { ...metadata, url };
}

export async function createTransaction(input: {
  sellerId: string;
  referralId: string;
  saleAmount: number;
  closingDate: string;
  notes?: string | null;
}) {
  return insertTransaction(input);
}

export async function getTransactions(input: {
  userId: string;
  userRole: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status?: "submitted" | "verified" | "rejected";
  page: number;
  limit: number;
}) {
  return fetchTransactions(input);
}

export async function getTransactionDetail(input: {
  transactionId: string;
  userId: string;
  userRole: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
}) {
  return fetchTransaction(input);
}

export async function updateTransaction(input: {
  transactionId: string;
  sellerId: string;
  saleAmount?: number;
  closingDate?: string;
  notes?: string | null;
}) {
  return editTransaction(input);
}

export async function uploadTransactionDocuments(input: {
  transactionId: string;
  sellerId: string;
  files: UploadedTransactionDocument[];
}) {
  const bucket = requireTransactionDocumentsBucket();

  const uploadedKeys: string[] = [];
  const insertedDocumentIds: string[] = [];

  try {
    const metadata: Array<{
      fileKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }> = [];

    // 1. Upload files to S3.
    for (const file of input.files) {
      const extension = extByMime[file.mimetype as keyof typeof extByMime];

      if (!extension) {
        throw new Error("Unsupported transaction document type");
      }

      const key = `${input.transactionId}/${randomUUID()}${extension}`;

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
        fileKey: key,
        fileName: basename(file.originalname).slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });
    }

    // 2. Insert database records one at a time.
    const documents = [];

    for (const item of metadata) {
      const document = await insertTransactionDocument({
        transactionId: input.transactionId,
        sellerId: input.sellerId,
        fileKey: item.fileKey,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      });

      documents.push(document);
      insertedDocumentIds.push(document.id);
    }

    // 3. Generate download URLs before returning success.
    const signedDocuments = await Promise.all(
      documents.map(signTransactionDocument),
    );

    return signedDocuments;
  } catch (error) {
    // 4. Remove database records created by this upload.
    for (const documentId of insertedDocumentIds) {
      try {
        await pool.query(`DELETE FROM transaction_documents WHERE id = $1`, [
          documentId,
        ]);
      } catch (cleanupError) {
        // Preserve the original error. Log cleanup failure for investigation.
        logger.error(
          { err: cleanupError, documentId },
          "Failed to clean up transaction document metadata",
        );
      }
    }

    // 5. Remove uploaded S3 objects.
    const cleanupResults = await Promise.allSettled(
      uploadedKeys.map((Key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key,
          }),
        ),
      ),
    );

    cleanupResults.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error(
          { err: result.reason, key: uploadedKeys[index] },
          "Failed to clean up transaction document in S3",
        );
      }
    });

    throw error;
  }
}

export async function getTransactionDocumentList(transactionId: string) {
  const documents = await listTransactionDocuments(transactionId);
  const validDocuments = documents.filter(
    (document): document is NonNullable<typeof document> =>
      document !== undefined,
  );

  return Promise.all(validDocuments.map(signTransactionDocument));
}

export async function decideTransaction(input: {
  transactionId: string;
  actorId: string;
  actorRole: "admin" | "finance_admin";
  decision: "verified" | "rejected";
  reason?: string;
}) {
  const result = await reviewTransaction(input);

  try {
    await notifyUser({
      recipientId: result.seller_id,
      type: "transaction_status_changed",
      title:
        input.decision === "verified"
          ? "Transaction verified"
          : "Transaction rejected",
      message:
        input.decision === "verified"
          ? "Your transaction has been verified."
          : "Your transaction has been rejected.",
      entityType: "transaction",
      entityId: input.transactionId,
    });
  } catch (error) {
    logger.error(
      { err: error, transactionId: input.transactionId },
      "Failed to create transaction decision notification",
    );
  }

  return result;
}
