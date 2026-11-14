import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const userRoles = [
  "buyer",
  "agent",
  "developer",
  "admin",
  "finance_admin",
] as const;
export const userStatuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
] as const;

export const adminUserListQuerySchema = paginationSchema
  .extend({
    q: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string().max(100).optional(),
      )
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    role: z.enum(userRoles).optional(),
    status: z.enum(userStatuses).optional(),

    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    emailVerified: z.enum(["true", "false"]).optional(),

    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine(
    (data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo,
    {
      message: "dateFrom must be before or equal to dateTo",
      path: ["dateTo"],
    },
  );

export type AdminUserListFilters = z.infer<typeof adminUserListQuerySchema>;

export const auditLogFiltersSchema = paginationSchema
  .extend({
    actor_id: z.string().uuid("Invalid actor_id").optional(),
    action: z.string().trim().min(1).max(150).optional(),
    entity_type: z.string().trim().min(1).max(100).optional(),
    entity_id: z.string().uuid("Invalid entity_id").optional(),
    start_date: z.string().datetime({ offset: true }).optional(),
    end_date: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (data) =>
      !data.start_date ||
      !data.end_date ||
      new Date(data.start_date) <= new Date(data.end_date),
    {
      message: "start_date must be before or equal to end_date",
      path: ["start_date"],
    },
  );

export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;

export const adminUserIdParamsSchema = z
  .object({
    id: z.string().uuid("Invalid user id"),
  })
  .strict();

export type AdminUserIdParams = z.infer<typeof adminUserIdParamsSchema>;

export const adminUserCreateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(255)
      .transform((email) => email.toLowerCase()),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number must contain at least 7 characters")
      .max(20, "Phone number must not exceed 20 characters")
      .regex(/^\+?[0-9().\-\s]+$/, "Enter a valid phone number"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must not exceed 128 characters"),
    role: z.enum(["admin", "finance_admin"]),
  })
  .strict();

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;

export const adminUserStatusUpdateSchema = z
  .object({
    action: z.enum(["suspend", "deactivate", "reactivate"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.action === "suspend" || data.action === "deactivate"
        ? data.reason !== undefined && data.reason.length > 0
        : true,
    {
      message: "reason is required for suspend and deactivate actions",
      path: ["reason"],
    },
  );

export type AdminUserStatusUpdateInput = z.infer<
  typeof adminUserStatusUpdateSchema
>;

export const adminPropertyLookupCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
  })
  .strict();

export type AdminPropertyLookupCreateInput = z.infer<
  typeof adminPropertyLookupCreateSchema
>;

export const adminPropertyLookupUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    name: z.string().trim().min(2).max(100).optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export type AdminPropertyLookupUpdateInput = z.infer<
  typeof adminPropertyLookupUpdateSchema
>;

export const adminPropertyLookupIdParamsSchema = z
  .object({
    id: z.string().uuid("Invalid lookup id"),
  })
  .strict();

export type AdminPropertyLookupIdParams = z.infer<
  typeof adminPropertyLookupIdParamsSchema
>;
