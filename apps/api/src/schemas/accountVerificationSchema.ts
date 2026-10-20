
import { z } from "zod";

export const submitAccountVerificationSchema = z.object({
  legalName: z.string().trim().min(2).max(150),
  registrationNumber: z.string().trim().min(1).max(100),
  businessName: z.string().trim().max(200).optional(),
  businessAddress: z.string().trim().min(2).max(300),
  contactPhone: z.string().trim().min(5).max(30),
  notes: z.string().trim().max(2000).optional(),
});

export type SubmitAccountVerificationInput = z.infer<
  typeof submitAccountVerificationSchema
>;

export const MAX_VERIFICATION_SUBMISSIONS = 3;
