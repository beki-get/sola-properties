CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    buyer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favorites_buyer_property_unique
        UNIQUE (buyer_id, property_id)
);

CREATE INDEX favorites_buyer_created_at_idx
ON favorites (buyer_id, created_at DESC);