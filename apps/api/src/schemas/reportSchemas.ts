import { z } from "zod";

export const reportQuerySchema = z.object({}).strict();

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
