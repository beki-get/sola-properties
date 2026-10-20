export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "land",
  "commercial",
  "townhouse",
  "condominium",
  "office",
  "retail",
  "industrial",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PAYMENT_PREFERENCES = ["cash", "installment", "mortgage"] as const;

export type PaymentPreference = (typeof PAYMENT_PREFERENCES)[number];

export const PROPERTY_FEATURES = [
  "garden",
  "parking",
  "balcony",
  "elevator",
  "security",
  "swimming_pool",
  "gym",
  "storage",
  "furnished",
  "air_conditioning",
] as const;

export type PropertyFeature = (typeof PROPERTY_FEATURES)[number];
