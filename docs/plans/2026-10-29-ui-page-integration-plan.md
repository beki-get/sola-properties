# Sola Properties: UI Pages & End-to-End Integration Implementation Plan

> **Backend Documentation:** [`docs/backend_api_verified_endpoints.md`](file:///d:/Others/Projects/Solanova%20Tech%20Solutions/sola-properties/docs/backend_api_verified_endpoints.md)  
> **API Base URL:** `https://sola-properties.onrender.com`  
> **Frontend App Directory:** `apps/web`  
> **Design Rules:** Strictly zero border-radius (`border-radius: 0px !important`), Swiss architectural typography, Space Grotesk, `#EAEBED` greige canvas, pure `#000000` accents.

---

## 1. Goal & Architecture

### Goal
Fully connect all **21 finished backend endpoints** with the Sola Properties frontend user interface—delivering complete workflows for Authentication, Role-based Dashboards (Buyer, Agent, Developer, Admin), Developer Project Management, Admin Oversight, and Account Verification.

### Architecture
- **API Layer (`apps/web/lib/api.ts`)**: Centralized typed client with Axios/Fetch, automatic 401 token refresh interceptor via HttpOnly cookie `sola_refresh_token`, and standardized `{ ok, status, data, message }` responses.
- **State Management**: Reactive React state with optimistic UI updates and instant toast/feedback banners.
- **Routing Structure (`apps/web/app/`)**:
  - `/` — Luxury Landing Page & Verified Listings showcase
  - `/login` — Account Sign In with inline unverified email resend
  - `/register` — Multi-role Onboarding (Buyer, Agent, Developer)
  - `/verify-email` — Email Verification Confirmation Handler
  - `/forgot-password` & `/reset-password` — Password Recovery flow
  - `/dashboard` — Unified Role-Based Workspace:
    - **Buyer Workspace**: Saved Properties, Inquiries, Visual Preferences Wizard, Profile
    - **Agent Workspace**: Listings, Leads, Verification Submission & Status Banner
    - **Developer Workspace**: Developments, **New Project Creation Form**, **Project Status Toggles**, Company Profile, Verification Uploads
    - **Admin Console**: Pending Verification Review Queue (Approve/Reject with Reason), **Master Project Directory** with status filter & pagination

---

## 2. Implementation Tasks

### Task 1: Complete Developer & Admin Projects Client API (`apps/web/lib/api.ts`)
Connect the newly discovered project endpoints in the typed API client.

**Files:**
- Modify: `apps/web/lib/api.ts`

**Endpoints to integrate:**
- `POST /api/v1/developer/projects` (`createProject`)
- `GET /api/v1/developer/projects` (`getMyProjects`)
- `GET /api/v1/developer/projects/{projectId}` (`getMyProjectById`)
- `PATCH /api/v1/developer/projects/{projectId}` (`updateMyProject`)
- `PATCH /api/v1/developer/projects/{projectId}/status` (`updateProjectStatus`)
- `GET /api/v1/admin/projects` (`getAllProjectsAdmin`)
- `GET /api/v1/admin/projects/{projectId}` (`getProjectByIdAdmin`)

---

### Task 2: Dedicated Email Verification Page (`/verify-email`)
Provide a professional landing page for users clicking their email verification link.

**Files:**
- Create: `apps/web/app/verify-email/page.tsx`
- Style: `apps/web/app/auth.module.css`

**Features:**
- Reads `?token=...` from URL query parameters.
- Dispatches `POST /api/v1/auth/verify-email`.
- Shows a verified state with instant "Proceed to Sign In" button.
- If token is invalid or expired, displays an error alert with a direct "Resend verification link" form.

---

### Task 3: Developer Projects Management UI (`/dashboard` Developer Tab)
Allow approved real estate developers to manage their property developments directly.

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/dashboard/dashboard.module.css`

**Features:**
- **Create Project Modal/Drawer**:
  - Form fields: `name` (required, 1-150 chars), `location` (required, 1-200 chars), `description` (optional, up to 5000 chars).
  - Validation matching backend `CreateProjectRequest`.
  - Dispatches `POST /api/v1/developer/projects`.
- **Project Grid / Directory**:
  - Displays project cards with status badges (`active` in green, `inactive` in muted gray), creation date, and location.
  - Action button: **Toggle Status** (`PATCH /api/v1/developer/projects/{id}/status`).
  - Action button: **Edit Details** (`PATCH /api/v1/developer/projects/{id}`).
- **Role Permission Guard**:
  - If developer status is `pending` or `rejected`, displays informative badge indicating that project publishing requires approved account verification.

---

### Task 4: Admin Projects Directory UI (`/dashboard` Admin Tab)
Provide platform administrators with visibility across all developer projects.

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/dashboard/dashboard.module.css`

**Features:**
- Paginated table listing all platform projects (`GET /api/v1/admin/projects?page=1&limit=10&status=...`).
- Filter dropdown: `All Projects`, `Active Only`, `Inactive Only`.
- Quick inspector modal showing project developer ID, description, timestamp, and metadata.

---

### Task 5: Interactive Buyer Preferences Visual Wizard (`/dashboard` Buyer Tab)
Enhance the property preference form to cover all 10 property types and amenities supported by the backend schema.

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Features:**
- **Property Types Multi-select Chips**:
  - Options: `Apartment`, `House`, `Villa`, `Land`, `Commercial`, `Townhouse`, `Condominium`, `Office`, `Retail`, `Industrial`.
- **Feature & Amenity Chips**:
  - Options: `Garden`, `Parking`, `Balcony`, `Elevator`, `Security`, `Swimming Pool`, `Gym`, `Storage`, `Furnished`, `Air Conditioning`.
- **Dual Budget & Size Controls**:
  - Min/Max Budget input in ETB/USD.
  - Min Floor Size (`sqm`) and Min Bedrooms.
  - Payment Preference selector: `Cash`, `Installment`, `Mortgage`.
- Dispatches `PUT /api/v1/buyer/me/preferences` with immediate visual feedback.

---

### Task 6: Account Verification Document Review & Rejection Remarks
Enhance the verification flow for Agent and Developer compliance auditing.

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Features:**
- **Applicant View**:
  - Shows uploaded documents with file names, sizes, and MIME types.
  - If rejected, displays the administrator's **rejection remarks** prominently with a one-click "Resubmit Updated Documents" trigger.
- **Admin Review Modal**:
  - Shows submitted business registration, legal entity name, and documents.
  - **Approve Button**: Dispatches `PATCH /api/v1/admin/account-verification/{id}/decision` with `{"decision": "approved"}`.
  - **Reject Button**: Opens an explicit reason input dialog requiring rejection feedback before dispatching `{"decision": "rejected", "rejectionReason": "..."}`.

---

## 3. Verification & Validation Steps

1. **Compilation Check**:
   Run `npm run build` or inspect Next.js routes to verify zero TypeScript or Turbopack compilation errors.
2. **Interactive UI Walkthrough**:
   - Register a new account (`/register`).
   - Sign in (`/login`) and verify access token + refresh cookie handling.
   - Navigate to `/dashboard` across Buyer, Agent, Developer, and Admin roles.
   - Test project creation, status toggling, and verification document submission against the live Render backend.
