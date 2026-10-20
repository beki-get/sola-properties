import {
  findDeveloperProfileByUserId,
  upsertDeveloperProfile,
} from "../queries/developerProfileQueries";
import type { UpdateDeveloperProfileInput } from "../schemas/developerProfileSchemas";

export async function getDeveloperProfile(userId: string) {
  return findDeveloperProfileByUserId(userId);
}

export async function updateDeveloperProfile(
  userId: string,
  input: UpdateDeveloperProfileInput,
) {
  const existing = await findDeveloperProfileByUserId(userId);

  const companyName = input.company_name ?? existing?.company_name ?? null;

  const contactPhone = input.contact_phone ?? existing?.contact_phone ?? null;

  const businessAddress =
    input.business_address ?? existing?.business_address ?? null;

  const missingFields: string[] = [];

  if (!companyName) missingFields.push("company_name");
  if (!contactPhone) missingFields.push("contact_phone");
  if (!businessAddress) missingFields.push("business_address");

  if (!companyName || !contactPhone || !businessAddress) {
    return {
      success: false as const,
      missingFields,
    };
  }

  const profile = await upsertDeveloperProfile(userId, {
    company_name: companyName,
    contact_phone: contactPhone,
    business_address: businessAddress,
    company_description:
      input.company_description !== undefined
        ? input.company_description
        : (existing?.company_description ?? null),
    website_url:
      input.website_url !== undefined
        ? input.website_url
        : (existing?.website_url ?? null),
  });

  return {
    success: true as const,
    profile,
  };
}
