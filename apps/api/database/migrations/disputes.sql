CREATE TABLE referral_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    referral_id UUID NOT NULL
        REFERENCES referrals(id) ON DELETE RESTRICT,

    reported_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    category TEXT NOT NULL CHECK (
        category IN (
            'communication',
            'property_information',
            'seller_behavior',
            'buyer_behavior',
            'payment',
            'visit_or_scheduling',
            'fraud_or_suspicious_activity',
            'other'
        )
    ),

    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN (
            'open',
            'under_review',
            'resolved',
            'dismissed'
        )),

    admin_notes TEXT,
    resolution TEXT,

    reviewed_by UUID
        REFERENCES users(id) ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT referral_issues_subject_not_blank
        CHECK (LENGTH(BTRIM(subject)) > 0),

    CONSTRAINT referral_issues_description_not_blank
        CHECK (LENGTH(BTRIM(description)) > 0),

    CONSTRAINT referral_issues_admin_notes_not_blank
        CHECK (admin_notes IS NULL OR LENGTH(BTRIM(admin_notes)) > 0),

    CONSTRAINT referral_issues_resolution_not_blank
        CHECK (resolution IS NULL OR LENGTH(BTRIM(resolution)) > 0)
);

CREATE INDEX referral_issues_referral_idx
    ON referral_issues (referral_id, created_at DESC);

CREATE INDEX referral_issues_reporter_idx
    ON referral_issues (reported_by, created_at DESC);

CREATE INDEX referral_issues_status_idx
    ON referral_issues (status, created_at DESC);