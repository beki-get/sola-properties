CREATE TABLE commission_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL
    REFERENCES commissions(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  created_by UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX commission_adjustments_commission_idx
  ON commission_adjustments(commission_id, created_at DESC);