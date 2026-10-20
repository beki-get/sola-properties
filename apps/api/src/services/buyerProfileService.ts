import {
  findBuyerProfileByUserId,
  upsertBuyerProfile,
} from "../queries/buyerProfileQueries";
import type { UpdateBuyerProfileInput } from "../schemas/buyerProfileSchemas";

export class BuyerProfileServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BuyerProfileServiceError";
  }
}

export interface BuyerProfileResult {
  userId: string;
  phoneNumber: string | null;
  preferredContactMethod: "email" | "phone" | "whatsapp" | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapBuyerProfile(
  profile: {
    user_id: string;
    phone_number: string | null;
    preferred_contact_method: "email" | "phone" | "whatsapp" | null;
    created_at: Date;
    updated_at: Date;
  },
): BuyerProfileResult {
  return {
    userId: profile.user_id,
    phoneNumber: profile.phone_number,
    preferredContactMethod: profile.preferred_contact_method,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function getBuyerProfile(
  userId: string,
): Promise<BuyerProfileResult> {
  const profile = await findBuyerProfileByUserId(userId);

  if (!profile) {
    throw new BuyerProfileServiceError(
      "Buyer profile not found",
      "BUYER_PROFILE_NOT_FOUND",
    );
  }

  return mapBuyerProfile(profile);
}

export async function updateBuyerProfile(
  userId: string,
  input: UpdateBuyerProfileInput,
): Promise<BuyerProfileResult> {
  const profile = await upsertBuyerProfile(userId, input);

  return mapBuyerProfile(profile);
}