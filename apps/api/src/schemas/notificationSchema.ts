import { z } from "zod";

export const notificationCreationSchema = z
  .object({
    recipientId: z.string().uuid(),
    type: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(4000),
    entityType: z.string().trim().min(1).max(100).nullable().optional(),
    entityId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type NotificationCreationInput = z.infer<
  typeof notificationCreationSchema
>;

export const notificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();

export const notificationIdParamSchema = z
  .object({
    notificationId: z.string().uuid(),
  })
  .strict();

export const NOTIFICATION_TYPES = [
  "commission_approved",
  "commission_payment_recorded",
  "commission_adjustment",
  "commission_dispute_opened",
  "referral_created",
  "referral_accepted",
  "referral_rejected",
  "referral_reassigned",
  "referral_status_changed",
  "property_price_decreased",
  "property_status_changed",
  "referral_message_received",
  "property_visit_requested",
  "property_visit_scheduled",
  "property_visit_updated",
  "property_visit_cancelled",
  "transaction_status_changed",
  "account_verification_approved",
  "account_verification_rejected",
  "account_status_changed",
  "property_agent_authorized",
  "property_agent_authorization_revoked",
] as const;

export const notificationPreferenceUpdateSchema = z
  .object({
    notificationType: z.enum(NOTIFICATION_TYPES),
    isEnabled: z.boolean(),
  })
  .strict();

export type NotificationPreferenceUpdateInput = z.infer<
  typeof notificationPreferenceUpdateSchema
>;
