-- Shared in-platform notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    type TEXT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    entity_type TEXT,
    entity_id UUID,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_read_state_consistent
        CHECK (
            (is_read = FALSE AND read_at IS NULL)
            OR
            (is_read = TRUE AND read_at IS NOT NULL)
        )
);

CREATE INDEX notifications_recipient_created_idx
    ON notifications (recipient_id, created_at DESC);

CREATE INDEX notifications_recipient_unread_idx
    ON notifications (recipient_id, created_at DESC)
    WHERE is_read = FALSE;
