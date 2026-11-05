import { z } from "zod";

export const visitIdSchema = z.string().uuid();
export const referralIdSchema = z.string().uuid();

const futureDateTime = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => new Date(value).getTime() > Date.now(),
    "Date and time must be in the future",
  );

export const createVisitRequestSchema = z.object({
  requestedAt: futureDateTime,
  location: z.string().trim().min(1).max(500).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

export const scheduleVisitSchema = z.object({
  scheduledAt: futureDateTime,
  location: z.string().trim().min(1).max(500).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});

export const updateVisitSchema = z
  .object({
    scheduledAt: futureDateTime.optional(),
    location: z.string().trim().min(1).max(500).nullable().optional(),
    notes: z.string().trim().min(1).max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const visitOutcomeSchema = z.object({
  outcome: z.enum([
    "interested",
    "not_interested",
    "requested_another_visit",
  ]),
  outcomeNote: z.string().trim().min(1).max(2000).optional(),
});

export const visitPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateVisitRequestInput = z.infer<
  typeof createVisitRequestSchema
>;
export type ScheduleVisitInput = z.infer<typeof scheduleVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type VisitOutcomeInput = z.infer<typeof visitOutcomeSchema>;