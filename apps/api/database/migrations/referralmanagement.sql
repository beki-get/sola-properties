
-- Buyer Inquiry and Referral Management

-- Referral status
CREATE TYPE referral_status AS ENUM (
    'assigned',
    'accepted',
    'rejected',
    'in_progress',
    'agreement',
    'closed_won',
    'closed_lost'
);

CREATE SEQUENCE referral_seq START WITH 1000;

-- Referrals: buyer inquiry and referral 
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reference_code TEXT NOT NULL UNIQUE
        DEFAULT ('REF-' || nextval('referral_seq')),

    buyer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE RESTRICT,

    assigned_to UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    message TEXT,

    status referral_status NOT NULL DEFAULT 'assigned',
    status_reason TEXT,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT referrals_message_not_blank
        CHECK (message IS NULL OR LENGTH(BTRIM(message)) > 0),

    CONSTRAINT referrals_status_reason_not_blank
        CHECK (
            status_reason IS NULL
            OR LENGTH(BTRIM(status_reason)) > 0
        )
);

-- One unresolved referral per buyer and property.
-- Rejected referrals remain included because an admin may reassign them.
CREATE UNIQUE INDEX referrals_one_open_per_buyer_property
    ON referrals (buyer_id, property_id)
    WHERE status NOT IN ('closed_won', 'closed_lost');

CREATE INDEX referrals_assigned_status_idx
    ON referrals (assigned_to, status);

CREATE INDEX referrals_buyer_idx
    ON referrals (buyer_id);

CREATE INDEX referrals_property_idx
    ON referrals (property_id);

CREATE INDEX referrals_created_at_idx
    ON referrals (created_at DESC);

--  Referral events: status and assignment history
CREATE TABLE referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    referral_id UUID NOT NULL
        REFERENCES referrals(id) ON DELETE RESTRICT,

    actor_id UUID
        REFERENCES users(id) ON DELETE SET NULL,

    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'created',
            'assigned',
            'accepted',
            'rejected',
            'status_changed',
            'reassigned'
        )),

    status referral_status NOT NULL,

    assigned_to UUID
        REFERENCES users(id) ON DELETE SET NULL,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT referral_events_note_not_blank
        CHECK (note IS NULL OR LENGTH(BTRIM(note)) > 0)
);

CREATE INDEX referral_events_history_idx
    ON referral_events (referral_id, created_at DESC);

CREATE INDEX referral_events_actor_idx
    ON referral_events (actor_id, created_at DESC);

--  Referral messages and private follow-up notes
CREATE TABLE referral_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    referral_id UUID NOT NULL
        REFERENCES referrals(id) ON DELETE RESTRICT,

    sender_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    kind TEXT NOT NULL
        CHECK (kind IN ('message', 'follow_up')),

    body TEXT NOT NULL,

    due_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT referral_messages_body_not_blank
        CHECK (LENGTH(BTRIM(body)) > 0)
);

CREATE INDEX referral_messages_history_idx
    ON referral_messages (referral_id, created_at DESC);

ALTER TABLE referral_events
ADD COLUMN previous_assigned_to UUID
REFERENCES users(id) ON DELETE SET NULL;
