
-- Disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type TEXT NOT NULL
        CHECK (entity_type IN ('transaction', 'commission')),

    entity_id UUID NOT NULL,

    reported_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    reason TEXT NOT NULL
        CHECK (LENGTH(BTRIM(reason)) > 0),

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'rejected')),

    resolution_note TEXT,
    resolved_by UUID
        REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disputes_resolution_note_required
        CHECK (
            status = 'open'
            OR NULLIF(BTRIM(resolution_note), '') IS NOT NULL
        ),

    CONSTRAINT disputes_resolution_fields_consistent
        CHECK (
            (status = 'open' AND resolved_by IS NULL AND resolved_at IS NULL)
            OR
            (status IN ('resolved', 'rejected')
                AND resolved_by IS NOT NULL
                AND resolved_at IS NOT NULL)
        )
);

CREATE INDEX disputes_entity_status_idx
    ON disputes (entity_type, entity_id, status);

CREATE INDEX disputes_reported_by_idx
    ON disputes (reported_by, created_at DESC);

CREATE UNIQUE INDEX disputes_one_open_per_entity_idx
    ON disputes (entity_type, entity_id)
    WHERE status = 'open';


