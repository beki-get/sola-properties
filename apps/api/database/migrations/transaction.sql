--transaction status
CREATE TYPE transaction_status AS ENUM (
    'submitted',
    'verified',
    'rejected'
);

--transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    referral_id UUID NOT NULL UNIQUE
        REFERENCES referrals(id) ON DELETE RESTRICT,

    buyer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE RESTRICT,

    seller_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    sale_amount NUMERIC(14,2) NOT NULL CHECK (sale_amount > 0),
    closing_date DATE NOT NULL,
    notes TEXT,

    status transaction_status NOT NULL DEFAULT 'submitted',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_notes_not_blank
        CHECK (notes IS NULL OR LENGTH(BTRIM(notes)) > 0),

    CONSTRAINT transactions_rejection_reason_required
        CHECK (
            status <> 'rejected'
            OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL
        )
);

CREATE INDEX transactions_buyer_idx
    ON transactions (buyer_id, created_at DESC);

CREATE INDEX transactions_seller_idx
    ON transactions (seller_id, status);

CREATE INDEX transactions_property_idx
    ON transactions (property_id);

CREATE INDEX transactions_status_idx
    ON transactions (status, created_at DESC);

--transaction documents
CREATE TABLE transaction_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL
        REFERENCES transactions(id) ON DELETE RESTRICT,

    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    uploaded_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transaction_documents_transaction_idx
    ON transaction_documents (transaction_id, created_at DESC);

CREATE INDEX transaction_documents_uploaded_by_idx
    ON transaction_documents (uploaded_by, created_at DESC);