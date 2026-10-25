import { z } from "zod";

const projectNameSchema = z.string().trim().min(1).max(150);
const projectLocationSchema = z.string().trim().min(1).max(200);
const projectDescriptionSchema = z.string().trim().max(5000).nullable();

export const createProjectSchema = z
  .object({
    name: projectNameSchema,
    location: projectLocationSchema,
    description: projectDescriptionSchema.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    location: projectLocationSchema.optional(),
    description: projectDescriptionSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export const updateProjectStatusSchema = z
  .object({
    status: z.enum(["active", "inactive"]),
  })
  .strict();

export const projectListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;