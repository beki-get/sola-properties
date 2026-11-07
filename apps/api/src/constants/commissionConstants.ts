export const COMMISSION_STATUSES = [
  "pending",
  "approved",
  "paid",
] as const;

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

// Payments represent the platform's share of the commission.
export const COMMISSION_PAYMENT_CAP_COLUMN = "platform_amount";