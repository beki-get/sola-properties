
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