import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findDeveloperProfileByUserId,
  upsertDeveloperProfile,
} from "../../src/queries/developerProfileQueries";
import { updateDeveloperProfile } from "../../src/services/developerProfileService";

vi.mock("../../src/queries/developerProfileQueries", () => ({
  findDeveloperProfileByUserId: vi.fn(),
  upsertDeveloperProfile: vi.fn(),
}));

const mockedFindProfile = vi.mocked(findDeveloperProfileByUserId);
const mockedUpsertProfile = vi.mocked(upsertDeveloperProfile);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("developer profile service", () => {
  it("reports missing required fields without writing an incomplete profile", async () => {
    mockedFindProfile.mockResolvedValue(null);

    const result = await updateDeveloperProfile("developer-1", {
      company_name: "Aster Development",
    });

    expect(result).toEqual({
      success: false,
      missingFields: ["contact_phone", "business_address"],
    });
    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("preserves existing required fields on a partial update", async () => {
    const existingProfile = {
      user_id: "developer-1",
      company_name: "Aster Development",
      company_description: null,
      contact_phone: "+251900123456",
      business_address: "2 Developer Road, Addis Ababa",
      website_url: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    };
    mockedFindProfile.mockResolvedValue(existingProfile as never);
    mockedUpsertProfile.mockResolvedValue({
      ...existingProfile,
      company_description: "Residential projects",
    } as never);

    const result = await updateDeveloperProfile("developer-1", {
      company_description: "Residential projects",
    });

    expect(mockedUpsertProfile).toHaveBeenCalledWith("developer-1", {
      company_name: "Aster Development",
      company_description: "Residential projects",
      contact_phone: "+251900123456",
      business_address: "2 Developer Road, Addis Ababa",
      website_url: null,
    });
    expect(result).toMatchObject({ success: true });
  });
});
