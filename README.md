# Sola Properties

Sola Properties is a real-estate platform backend and web-app monorepo. The API supports property discovery and management, buyer inquiries, and workflows for buyers, agents, developers, and administrators.

> **Project status:** The API and its OpenAPI documentation are implemented. The Next.js web app is currently a starter scaffold and has not yet been connected to the platform API.

## Features

- Account registration, email verification, login, refresh sessions, logout, and password reset
- Buyer, agent, and developer profiles, plus buyer property preferences and recommendations
- Developer project management
- Property listings with search, filters, sorting, comparison, and image uploads
- Property approval and account-verification workflows for administrators
- Developer-to-agent property authorizations
- Buyer inquiries and referral tracking
- PostgreSQL persistence, S3-compatible file storage, and structured API logging
- Interactive API documentation generated from an OpenAPI specification

## Repository structure

```text
.
├── apps/
│   ├── api/                 # Express + TypeScript API
│   └── web/                 # Next.js web app (starter scaffold)
├── packages/
│   ├── eslint-config/       # Shared ESLint configuration
│   ├── shared-types/        # Shared TypeScript types
│   ├── typescript-config/   # Shared TypeScript configuration
│   └── ui/                  # Shared React UI components
├── package.json             # npm workspaces and root scripts
└── turbo.json               # Turborepo task configuration
```

## Tech stack

- **Web:** Next.js 16, React 19, TypeScript
- **API:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **File storage:** S3-compatible object storage
- **Monorepo:** npm workspaces and Turborepo

## Prerequisites

- Node.js 24 or later
- npm 11.20.0
- A PostgreSQL database
- SMTP credentials for email verification and password-reset emails
- S3-compatible storage credentials and buckets for uploaded files

## Getting started

1. Clone the repository and install dependencies from the repository root:

   ```bash
   git clone https://github.com/beki-get/sola-properties.git
   cd sola-properties
   npm install
   ```

2. Create and configure the database. The base schema is in `apps/api/database/schema.sql`; review and apply any applicable SQL migrations in `apps/api/database/migrations/` for your database state.

3. Configure the API environment variables. The API reads configuration from environment variables, including:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_ACCESS_SECRET` | Secret used to sign access tokens (at least 32 characters) |
   | `CLIENT_URL` | Web app origin allowed by CORS (defaults to `http://localhost:3000`) |
   | `PORT` | API port (defaults to `8080`) |
   | `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASSWORD` | SMTP settings for email |
   | `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3-compatible storage connection |
   | `NEON_STORAGE_BUCKET` | Bucket for account-verification documents |
   | `NEON_PROPERTY_IMAGES_BUCKET` | Bucket for property images |

   Keep credentials private; do not commit real secrets. The API's seed script also requires `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_FINANCE_ADMIN_EMAIL`, and `SEED_FINANCE_ADMIN_PASSWORD`.

4. Start the development tasks from the repository root:

   ```bash
   npm run dev
   ```

   The web app runs at [http://localhost:3000](http://localhost:3000), and the API runs at [http://localhost:8080](http://localhost:8080). The API checks its PostgreSQL connection when it starts.

## API documentation

Once the API is running, open [http://localhost:8080/api/docs](http://localhost:8080/api/docs) for the interactive Swagger UI. The OpenAPI document is also available at [http://localhost:8080/api/docs/openapi.json](http://localhost:8080/api/docs/openapi.json).

The deployed API is listed in the OpenAPI specification at [https://sola-properties.onrender.com](https://sola-properties.onrender.com).

## Useful commands

Run these commands from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start development tasks |
| `npm run build` | Build all workspaces with a build task |
| `npm run lint` | Run lint tasks configured in the workspaces |
| `npm run check-types` | Run TypeScript checks for configured workspaces |
| `npm run format` | Format TypeScript, TSX, and Markdown files with Prettier |
| `npm run --workspace=api test` | Run API tests |
| `npm run --workspace=api test:watch` | Run API tests in watch mode |
| `npm run --workspace=api seed:auth-test-users` | Create or update the privileged test users (requires the seed environment variables above) |

## API overview

The API is versioned under `/api/v1`. Main route groups include:

- `/api/v1/auth` — account and session operations
- `/api/v1/account-verification` — agent and developer verification applications
- `/api/v1/buyer`, `/api/v1/agent`, `/api/v1/developer` — profiles and preferences
- `/api/v1/developer/projects` and `/api/v1/admin/projects` — project management
- `/api/v1/properties` — property search, details, comparisons, management, and images
- `/api/v1/admin/properties` — property review and decisions
- `/api/v1/referrals` — buyer inquiries and referral management

For request and response schemas, authentication requirements, and the complete endpoint list, use the interactive API documentation.

## Contributing

Contributions and suggestions are welcome. For changes to the API, use the OpenAPI docs and existing tests as a guide. Please avoid committing secrets or production data.
