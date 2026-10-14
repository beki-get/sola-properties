
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
