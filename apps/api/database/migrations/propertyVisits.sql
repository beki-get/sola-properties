CREATE TABLE property_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    referral_id UUID NOT NULL
        REFERENCES referrals(id) ON DELETE RESTRICT,

    -- Buyer's preferred date and time
    requested_at TIMESTAMPTZ NOT NULL,

    -- Final date and time set by the seller
    scheduled_at TIMESTAMPTZ,

    location TEXT,
    notes TEXT,

    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (
            status IN (
                'requested',
                'scheduled',
                'completed',
                'cancelled'
            )
        ),

    outcome TEXT
        CHECK (
            outcome IS NULL OR outcome IN (
                'interested',
                'not_interested',
                'requested_another_visit'
            )
        ),

    outcome_note TEXT,

    outcome_recorded_by UUID
        REFERENCES users(id) ON DELETE SET NULL,

    outcome_recorded_at TIMESTAMPTZ,

    -- Preserve previous outcomes when an outcome is updated
    outcome_history JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT property_visits_location_not_blank
        CHECK (location IS NULL OR LENGTH(BTRIM(location)) > 0),

    CONSTRAINT property_visits_notes_not_blank
        CHECK (notes IS NULL OR LENGTH(BTRIM(notes)) > 0),

    CONSTRAINT property_visits_outcome_note_not_blank
        CHECK (outcome_note IS NULL OR LENGTH(BTRIM(outcome_note)) > 0),

    CONSTRAINT property_visits_scheduled_time_required
        CHECK (status NOT IN ('scheduled', 'completed') OR scheduled_at IS NOT NULL),

    CONSTRAINT property_visits_outcome_required
        CHECK (
            status <> 'completed'
            OR (
                outcome IS NOT NULL
                AND outcome_recorded_by IS NOT NULL
                AND outcome_recorded_at IS NOT NULL
            )
        )
);

-- Only one active visit request or scheduled visit per referral.
CREATE UNIQUE INDEX property_visits_one_active_per_referral_idx
ON property_visits (referral_id)
WHERE status IN ('requested', 'scheduled');

CREATE INDEX property_visits_referral_date_idx
ON property_visits (referral_id, requested_at DESC);

CREATE INDEX property_visits_created_by_idx
ON property_visits (created_by);