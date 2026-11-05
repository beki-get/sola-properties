
-- 1. Enum types

CREATE TYPE app_role AS ENUM (
    'buyer',
    'agent',
    'developer',
    'admin',
    'finance_admin'
);

CREATE TYPE account_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'suspended',
    'deactivated'
);


-- 2. Users

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,

    role app_role NOT NULL,
    status account_status NOT NULL DEFAULT 'pending',

    email_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_unique
    ON users (LOWER(email));

-- 3. Refresh tokens

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    token_family_id UUID NOT NULL DEFAULT gen_random_uuid(),

    replaced_by_token_id UUID
        REFERENCES refresh_tokens(id) ON DELETE SET NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    user_agent TEXT,
    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_id_idx
    ON refresh_tokens(user_id);

CREATE INDEX refresh_tokens_family_id_idx
    ON refresh_tokens(token_family_id);

CREATE INDEX refresh_tokens_expires_at_idx
    ON refresh_tokens(expires_at);


-- 4. Password reset tokens

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_resets_user_id_idx
    ON password_resets(user_id);


-- 5. Email verification tokens

CREATE TABLE email_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    email_to_verify VARCHAR(255) NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_verification_user_id_idx
    ON email_verification(user_id);



-- Account verification request history.
CREATE TYPE verification_request_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);
-- 6.account_verification_requests
CREATE TABLE account_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    applicant_role app_role NOT NULL
        CHECK (applicant_role IN ('agent', 'developer')),

    legal_name VARCHAR(150) NOT NULL,
    registration_number VARCHAR(100) NOT NULL,
    business_name VARCHAR(200),
    business_address VARCHAR(300) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    notes TEXT,

    status verification_request_status NOT NULL DEFAULT 'pending',

    rejection_reason TEXT,

    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT verification_rejection_reason_required
        CHECK (
            status <> 'rejected'
            OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL
        ),

    CONSTRAINT verification_review_fields_consistent
        CHECK (
            (status = 'pending'
                AND reviewed_at IS NULL
                AND reviewed_by IS NULL
                AND rejection_reason IS NULL)
            OR
            (status = 'approved'
                AND reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
                AND rejection_reason IS NULL)
            OR
            (status = 'rejected'
                AND reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
                AND NULLIF(BTRIM(rejection_reason), '') IS NOT NULL)
        )
);

-- Enforce one open request per user, including concurrent submissions.
CREATE UNIQUE INDEX account_verification_one_pending_per_user
    ON account_verification_requests (user_id)
    WHERE status = 'pending';

CREATE INDEX account_verification_user_history_idx
    ON account_verification_requests (user_id, submitted_at DESC);

CREATE INDEX account_verification_pending_review_idx
    ON account_verification_requests (submitted_at ASC)
    WHERE status = 'pending';

-- Buyer profile
CREATE TABLE buyer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20),
    preferred_contact_method VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT buyer_profiles_contact_method_check
        CHECK (
            preferred_contact_method IS NULL
            OR preferred_contact_method IN ('email', 'phone', 'whatsapp')
        )
);

-- Agent profile
CREATE TABLE agent_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    phone_number VARCHAR(30),
    agency_name VARCHAR(200),
    bio TEXT,
    years_of_experience INTEGER
        CHECK (years_of_experience IS NULL OR years_of_experience >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--developer profile
CREATE TABLE developer_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    company_name VARCHAR(200) NOT NULL,
    company_description TEXT,
    contact_phone VARCHAR(30) NOT NULL,
    business_address VARCHAR(300) NOT NULL,
    website_url VARCHAR(2048),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE preferences (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    budget_min NUMERIC(14, 2),
    budget_max NUMERIC(14, 2),

    property_types TEXT[] NOT NULL DEFAULT '{}',
    locations TEXT[] NOT NULL DEFAULT '{}',
    features TEXT[] NOT NULL DEFAULT '{}',

    min_size_sqm NUMERIC(12, 2),
    min_bedrooms INTEGER,

    payment_preference TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT preferences_budget_min_check
        CHECK (budget_min IS NULL OR budget_min >= 0),

    CONSTRAINT preferences_budget_max_check
        CHECK (budget_max IS NULL OR budget_max >= 0),

    CONSTRAINT preferences_budget_range_check
        CHECK (
            budget_min IS NULL
            OR budget_max IS NULL
            OR budget_min <= budget_max
        ),

    CONSTRAINT preferences_min_size_check
        CHECK (min_size_sqm IS NULL OR min_size_sqm > 0),

    CONSTRAINT preferences_min_bedrooms_check
        CHECK (min_bedrooms IS NULL OR min_bedrooms > 0)
);

--projects
CREATE TYPE project_status AS ENUM (
    'active',
    'inactive'
);

--projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    developer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,

    status project_status NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT projects_name_not_blank
        CHECK (LENGTH(BTRIM(name)) > 0),

    CONSTRAINT projects_location_not_blank
        CHECK (LENGTH(BTRIM(location)) > 0)
);

CREATE UNIQUE INDEX projects_developer_name_unique_idx
    ON projects (developer_id, LOWER(name));


CREATE TYPE property_status AS ENUM (
    'draft',
    'pending_approval',
    'active',
    'inactive',
    'sold',
    'rejected'
    
);

--properties
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    project_id UUID
        REFERENCES projects(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL,
    location TEXT NOT NULL,
    size_sqm NUMERIC(12, 2),
    bedrooms INTEGER,
    bathrooms INTEGER,
    features TEXT[] NOT NULL DEFAULT '{}',
     price NUMERIC(14, 2),
    payment_plan TEXT,
    rejection_reason TEXT,
    status property_status NOT NULL DEFAULT 'draft',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT properties_title_not_blank
        CHECK (LENGTH(BTRIM(title)) > 0),

    CONSTRAINT properties_location_not_blank
        CHECK (LENGTH(BTRIM(location)) > 0),

    CONSTRAINT properties_size_positive
        CHECK (size_sqm IS NULL OR size_sqm > 0),

    CONSTRAINT properties_bedrooms_nonnegative
        CHECK (bedrooms IS NULL OR bedrooms >= 0),

    CONSTRAINT properties_bathrooms_nonnegative
        CHECK (bathrooms IS NULL OR bathrooms >= 0)
);

CREATE INDEX properties_owner_id_idx
    ON properties (owner_id);

CREATE INDEX properties_project_id_idx
    ON properties (project_id);

CREATE INDEX properties_status_idx
    ON properties (status);


--audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_actor_id_idx
  ON audit_logs (actor_id);

CREATE INDEX audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id);

CREATE INDEX audit_logs_created_at_idx
  ON audit_logs (created_at DESC);

  --verification-documents
CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL
    REFERENCES account_verification_requests(id) ON DELETE RESTRICT,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX verification_documents_request_idx
  ON verification_documents (verification_request_id);


  --property_images
CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE RESTRICT,
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL
        CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    file_size INTEGER NOT NULL
        CHECK (file_size > 0 AND file_size <= 5242880),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0
        CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX property_images_property_id_idx
    ON property_images(property_id);

CREATE UNIQUE INDEX property_images_one_primary_per_property_idx
    ON property_images(property_id)
    WHERE is_primary = TRUE;


--property agent authorizations
CREATE TYPE property_authorization_status AS ENUM (
    'active',
    'revoked'
);

CREATE TABLE property_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    authorized_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    status property_authorization_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT property_authorizations_property_agent_unique
        UNIQUE (property_id, agent_id)
);

CREATE INDEX property_authorizations_agent_status_idx
    ON property_authorizations(agent_id, status);

CREATE INDEX property_authorizations_property_status_idx
    ON property_authorizations(property_id, status);


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

--favorites
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

--referral issues
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