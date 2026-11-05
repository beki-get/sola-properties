import { z } from "zod";

export const addFavoriteSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
});

export const favoritePaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});