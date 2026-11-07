-- Commission Management (BE-084 to BE-096)

-- Commission agreements
CREATE TABLE commission_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  commission_rate_pct NUMERIC(5,2) NOT NULL
    CHECK (commission_rate_pct > 0 AND commission_rate_pct <= 100),
  platform_share_pct NUMERIC(5,2) NOT NULL
    CHECK (platform_share_pct >= 0 AND platform_share_pct <= 100),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX one_active_agreement
  ON commission_agreements (
    (COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::UUID))
  )
  WHERE effective_to IS NULL;

-- Default platform commission agreement
INSERT INTO commission_agreements (
  seller_id,
  commission_rate_pct,
  platform_share_pct
)
VALUES (NULL, 3.00, 20.00);

-- Commissions
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE
    REFERENCES transactions(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  agreement_id UUID NOT NULL
    REFERENCES commission_agreements(id) ON DELETE RESTRICT,
  sale_amount NUMERIC(14,2) NOT NULL,
  commission_rate_pct NUMERIC(5,2) NOT NULL,
  platform_share_pct NUMERIC(5,2) NOT NULL,
  total_commission NUMERIC(14,2) NOT NULL,
  platform_amount NUMERIC(14,2) NOT NULL,
  seller_amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (platform_amount + seller_amount = total_commission)
);

CREATE INDEX commissions_seller_idx
  ON commissions (seller_id, status);

-- Commission payments
CREATE TABLE commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL
    REFERENCES commissions(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL,
  reference TEXT,
  recorded_by UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX commission_payments_idx
  ON commission_payments (commission_id);