export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://sola-properties.onrender.com";

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: "buyer" | "agent" | "developer";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  message: string;
  data?: {
    accessToken?: string;
    user?: User;
  } | User;
}

export interface BuyerProfile {
  id?: string;
  userId?: string;
  phoneNumber?: string | null;
  preferredContactMethod?: "email" | "phone" | "whatsapp" | null;
}

export interface BuyerPreferencesInput {
  budget_min?: number | null;
  budget_max?: number | null;
  property_types?: (
    | "apartment"
    | "house"
    | "villa"
    | "land"
    | "commercial"
    | "townhouse"
    | "condominium"
    | "office"
    | "retail"
    | "industrial"
  )[] | null;
  locations?: string[] | null;
  features?: (
    | "garden"
    | "parking"
    | "balcony"
    | "elevator"
    | "security"
    | "swimming_pool"
    | "gym"
    | "storage"
    | "furnished"
    | "air_conditioning"
  )[] | null;
  min_size_sqm?: number | null;
  min_bedrooms?: number | null;
  payment_preference?: "cash" | "installment" | "mortgage" | null;
}

export interface AgentProfile {
  id?: string;
  user_id?: string;
  phone_number?: string | null;
  agency_name?: string | null;
  bio?: string | null;
  years_of_experience?: number | null;
}

export interface DeveloperProfile {
  id?: string;
  user_id?: string;
  company_name: string;
  company_description?: string | null;
  contact_phone: string;
  business_address: string;
  website_url?: string | null;
}

export interface Project {
  id: string;
  developer_id: string;
  name: string;
  location: string;
  description?: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CreateProjectPayload {
  name: string;
  location: string;
  description?: string | null;
}

export interface UpdateProjectPayload {
  name?: string;
  location?: string;
  description?: string | null;
}

export interface UpdateProjectStatusPayload {
  status: "active" | "inactive";
}

export interface ProjectListResult {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VerificationDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface VerificationSubmission {
  id: string;
  userId?: string;
  legalName: string;
  registrationNumber: string;
  businessName?: string;
  businessAddress: string;
  contactPhone: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  createdAt?: string;
  documents?: VerificationDocument[];
}

export interface VerificationDecisionPayload {
  decision: "approved" | "rejected";
  rejectionReason?: string;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  const url = `${API_BASE_URL.replace(/\/$/, "")}${endpoint}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Do not set Content-Type for multipart/form-data so browser sets the boundary automatically
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("sola_access_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Ensure refresh cookie is sent
    });

    const json = await res.json().catch(() => null);

    // Auto-refresh token if 401 Unauthorized occurs on an authenticated route
    if (
      res.status === 401 &&
      !isRetry &&
      !endpoint.includes("/auth/login") &&
      !endpoint.includes("/auth/refresh")
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(
            `${API_BASE_URL.replace(/\/$/, "")}/api/v1/auth/refresh`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            }
          );

          const refreshJson = await refreshRes.json().catch(() => null);
          if (refreshRes.ok && refreshJson?.data?.accessToken) {
            const newToken = refreshJson.data.accessToken;
            if (typeof window !== "undefined") {
              localStorage.setItem("sola_access_token", newToken);
            }
            isRefreshing = false;
            onTokenRefreshed(newToken);
          } else {
            isRefreshing = false;
            onTokenRefreshed(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("sola_access_token");
              localStorage.removeItem("sola_user");
            }
          }
        } catch {
          isRefreshing = false;
          onTokenRefreshed(null);
        }
      }

      // Wait for the active refresh to finish
      return new Promise((resolve) => {
        addRefreshSubscriber(async (newToken) => {
          if (newToken) {
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };
            const retryResult = await apiRequest<T>(
              endpoint,
              { ...options, headers: retryHeaders },
              true
            );
            resolve(retryResult);
          } else {
            resolve({
              ok: false,
              status: 401,
              message: json?.message || "Session expired. Please log in again.",
              data: json,
            });
          }
        });
      });
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message:
          json?.message ||
          json?.error ||
          `Request failed with status ${res.status}`,
        data: json,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: json,
      message: json?.message,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      message:
        err.message || "Network error. Please check your internet connection.",
    };
  }
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: async (payload: LoginPayload) => {
    const result = await apiRequest<{
      message: string;
      data: { accessToken: string; user: User };
    }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (
      result.ok &&
      result.data?.data?.accessToken &&
      typeof window !== "undefined"
    ) {
      localStorage.setItem("sola_access_token", result.data.data.accessToken);
      localStorage.setItem("sola_user", JSON.stringify(result.data.data.user));
    }
    return result;
  },

  getMe: async () => {
    const res = await apiRequest<{ message?: string; data?: User; user?: User }>(
      "/api/v1/auth/me",
      { method: "GET" }
    );
    const userData = res.data?.data || (res.data as any)?.user;
    if (res.ok && userData && typeof window !== "undefined") {
      localStorage.setItem("sola_user", JSON.stringify(userData));
    }
    return res;
  },

  updateMe: async (payload: UpdateUserPayload) => {
    const res = await apiRequest<{ message?: string; data?: User }>(
      "/api/v1/auth/me",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
    if (res.ok && res.data?.data && typeof window !== "undefined") {
      localStorage.setItem("sola_user", JSON.stringify(res.data.data));
    }
    return res;
  },

  verifyEmail: (payload: VerifyEmailPayload) =>
    apiRequest<{ message: string; data?: User }>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resendVerification: (payload: ResendVerificationPayload) =>
    apiRequest<{ message: string }>("/api/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  refresh: async () => {
    const res = await apiRequest<{ message: string; data: { accessToken: string } }>(
      "/api/v1/auth/refresh",
      { method: "POST" }
    );
    if (res.ok && res.data?.data?.accessToken && typeof window !== "undefined") {
      localStorage.setItem("sola_access_token", res.data.data.accessToken);
    }
    return res;
  },

  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiRequest<{ message: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiRequest<{ message: string }>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: async () => {
    try {
      await apiRequest<{ message: string }>("/api/v1/auth/logout", {
        method: "POST",
      });
    } catch {
      // Proceed with local cleanup regardless
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sola_access_token");
        localStorage.removeItem("sola_user");
      }
    }
  },

  getCurrentUser: (): User | null => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sola_user");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  },

  isAuthenticated: (): boolean => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("sola_access_token");
    }
    return false;
  },
};

export const buyerApi = {
  getProfile: () =>
    apiRequest<{ message?: string; data?: BuyerProfile; profile?: BuyerProfile }>(
      "/api/v1/buyer/me"
    ),
  updateProfile: (payload: Partial<BuyerProfile>) =>
    apiRequest<{ message?: string; data?: BuyerProfile; profile?: BuyerProfile }>(
      "/api/v1/buyer/me",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  getPreferences: () =>
    apiRequest<{ message?: string; data?: BuyerPreferencesInput; preferences?: BuyerPreferencesInput }>(
      "/api/v1/buyer/me/preferences"
    ),
  updatePreferences: (payload: BuyerPreferencesInput) =>
    apiRequest<{ message?: string; data?: BuyerPreferencesInput; preferences?: BuyerPreferencesInput }>(
      "/api/v1/buyer/me/preferences",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    ),
  patchPreferences: (payload: Partial<BuyerPreferencesInput>) =>
    apiRequest<{ message?: string; data?: BuyerPreferencesInput; preferences?: BuyerPreferencesInput }>(
      "/api/v1/buyer/me/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const agentApi = {
  getProfile: () =>
    apiRequest<{ message?: string; data?: AgentProfile; profile?: AgentProfile }>(
      "/api/v1/agent/me"
    ),
  updateProfile: (payload: Partial<AgentProfile>) =>
    apiRequest<{ message?: string; data?: AgentProfile; profile?: AgentProfile }>(
      "/api/v1/agent/me",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const developerApi = {
  getProfile: () =>
    apiRequest<{ message?: string; data?: DeveloperProfile; profile?: DeveloperProfile }>(
      "/api/v1/developer/me"
    ),
  updateProfile: (payload: Partial<DeveloperProfile>) =>
    apiRequest<{ message?: string; data?: DeveloperProfile; profile?: DeveloperProfile }>(
      "/api/v1/developer/me",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // Project Endpoints
  getProjects: () =>
    apiRequest<{
      message?: string;
      result?: ProjectListResult;
      projects?: Project[];
      pagination?: any;
    }>("/api/v1/developer/projects"),

  getProjectById: (projectId: string) =>
    apiRequest<{ message?: string; project?: Project; data?: Project }>(
      `/api/v1/developer/projects/${projectId}`
    ),

  createProject: (payload: CreateProjectPayload) =>
    apiRequest<{ message?: string; project?: Project; data?: Project }>(
      "/api/v1/developer/projects",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  updateProject: (projectId: string, payload: UpdateProjectPayload) =>
    apiRequest<{ message?: string; project?: Project; data?: Project }>(
      `/api/v1/developer/projects/${projectId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updateProjectStatus: (projectId: string, payload: UpdateProjectStatusPayload) =>
    apiRequest<{ message?: string; project?: Project; data?: Project }>(
      `/api/v1/developer/projects/${projectId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const verificationApi = {
  submit: (formData: FormData) =>
    apiRequest<{ message: string; data: VerificationSubmission }>(
      "/api/v1/account-verification",
      {
        method: "POST",
        body: formData,
      }
    ),
  getMyHistory: () =>
    apiRequest<{
      message?: string;
      data?: VerificationSubmission[];
      requests?: VerificationSubmission[];
    }>("/api/v1/account-verification/me"),
};

export const adminApi = {
  getPendingApplications: () =>
    apiRequest<{
      message?: string;
      data?: VerificationSubmission[];
      requests?: VerificationSubmission[];
      total?: number;
    }>("/api/v1/admin/account-verification"),

  getDetails: (requestId: string) =>
    apiRequest<{ message: string; data: VerificationSubmission }>(
      `/api/v1/admin/account-verification/${requestId}`
    ),

  decision: (requestId: string, payload: VerificationDecisionPayload) =>
    apiRequest<{ message: string; data: any }>(
      `/api/v1/admin/account-verification/${requestId}/decision`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  getAllProjects: (params?: {
    page?: number;
    limit?: number;
    status?: "active" | "inactive";
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return apiRequest<{
      projects?: Project[];
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      message?: string;
    }>(`/api/v1/admin/projects${qs ? `?${qs}` : ""}`);
  },

  getProjectById: (projectId: string) =>
    apiRequest<{ message?: string; project?: Project }>(
      `/api/v1/admin/projects/${projectId}`
    ),
};

// ==========================================
// EXPANDED DATA TYPES (ALL BACKEND MODULES)
// ==========================================

export interface PropertyCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  created_at: string;
}

export interface PropertyLocation {
  id: string;
  name: string;
  sub_city?: string | null;
  city?: string | null;
  is_active?: boolean;
  created_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  is_primary?: boolean;
  sort_order?: number;
  created_at: string;
}

export interface PropertyHistoryItem {
  id: string;
  property_id: string;
  old_price?: number;
  new_price?: number;
  change_type?: string;
  notes?: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  developer_id?: string | null;
  agent_id?: string | null;
  project_id?: string | null;
  title: string;
  description?: string | null;
  category_id: string;
  category_name?: string;
  location_id: string;
  location_name?: string;
  address?: string | null;
  size_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features?: string[];
  price: number | string;
  payment_plan?: "cash" | "installment" | "mortgage";
  status: "draft" | "pending_approval" | "active" | "inactive" | "sold" | "rejected";
  images?: PropertyImage[];
  created_at: string;
  updated_at: string;
}

export interface CreatePropertyPayload {
  title: string;
  description?: string | null;
  category_id: string;
  location_id: string;
  size_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features?: string[];
  price: number | string;
  payment_plan: "cash" | "installment" | "mortgage";
  project_id?: string | null;
}

export interface Referral {
  id: string;
  property_id: string;
  property?: Property;
  property_title?: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  seller_id?: string;
  seller_name?: string;
  status:
    | "assigned"
    | "accepted"
    | "rejected"
    | "in_progress"
    | "agreement"
    | "closed_won"
    | "closed_lost";
  notes?: string | null;
  rejection_reason?: string | null;
  closed_lost_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralMessage {
  id: string;
  referral_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role?: string;
  message: string;
  created_at: string;
}

export interface ReferralFollowUp {
  id: string;
  referral_id: string;
  author_id: string;
  author_name?: string;
  notes: string;
  created_at: string;
}

export interface ReferralIssue {
  id: string;
  referral_id: string;
  reported_by?: string;
  issue_type?: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  resolution_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyVisit {
  id: string;
  referral_id: string;
  buyer_id?: string;
  property_id?: string;
  property_title?: string;
  requested_at: string;
  scheduled_at?: string | null;
  location?: string | null;
  status: "requested" | "scheduled" | "completed" | "cancelled" | "no_show";
  outcome?: "interested" | "not_interested" | "requested_another_visit" | null;
  outcome_notes?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  property_id: string;
  property?: Property;
  created_at: string;
}

export interface Transaction {
  id: string;
  referral_id?: string;
  property_id: string;
  property_title?: string;
  buyer_id: string;
  buyer_name?: string;
  seller_id: string;
  seller_name?: string;
  sale_amount: number;
  closing_date: string;
  status: "submitted" | "verified" | "rejected";
  rejection_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionDocument {
  id: string;
  transaction_id: string;
  file_url: string;
  document_type?: string;
  created_at: string;
}

export interface CommissionAgreement {
  id: string;
  seller_id?: string | null;
  seller_name?: string | null;
  commission_rate_pct: number;
  platform_share_pct: number;
  effective_from: string;
  effective_to?: string | null;
  created_at: string;
}

export interface Commission {
  id: string;
  transaction_id: string;
  seller_id: string;
  agreement_id: string;
  sale_amount: number;
  commission_rate_pct: number;
  platform_share_pct: number;
  total_commission: number;
  platform_amount: number;
  seller_amount: number;
  status: "pending" | "approved" | "paid";
  approved_at?: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  transaction_id?: string | null;
  commission_id?: string | null;
  opened_by: string;
  reason: string;
  status: "open" | "resolved" | "rejected";
  resolution_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreference {
  id?: string;
  user_id?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  in_app_notifications?: boolean;
  marketing_notifications?: boolean;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  emailVerified?: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: any;
  created_at: string;
}

export interface AgentReport {
  properties?: {
    total: number;
    byStatus?: Record<string, number>;
  };
  referrals?: {
    total: number;
    byStatus?: Record<string, number>;
  };
  sales?: {
    totalSalesCount: number;
    totalSalesValue: string;
  };
  commissions?: {
    totalCommission: string;
    sellerEarnings: string;
    adjustments: string;
    amountPaid: string;
    outstandingAmount: string;
  };
  authorizedProperties?: {
    total: number;
  };
  active_listings?: number;
  total_referrals?: number;
  closed_deals?: number;
  total_commission?: number;
  data?: any;
}

export interface DeveloperReport {
  totalProjects?: number;
  totalProperties?: number;
  authorizedAgents?: number;
  referrals?: {
    total: number;
    byStatus?: Record<string, number>;
  };
  active_projects?: number;
  total_properties?: number;
  authorized_agents?: number;
  total_inquiries?: number;
  total_sales?: number;
  data?: any;
}

export interface AdminReport {
  total_users?: number;
  total_properties?: number;
  pending_properties?: number;
  total_gmv?: number;
  data?: any;
}

export interface FinanceAdminReport {
  total_commissions_earned?: number;
  platform_revenue?: number;
  pending_payouts?: number;
  paid_commissions?: number;
  data?: any;
}

// ==========================================
// EXTENDED API MODULES
// ==========================================

export const propertyApi = {
  // Public Lookups
  getCategories: () =>
    apiRequest<{ categories?: PropertyCategory[]; data?: PropertyCategory[] }>(
      "/api/v1/properties/categories"
    ),

  getLocations: () =>
    apiRequest<{ locations?: PropertyLocation[]; data?: PropertyLocation[] }>(
      "/api/v1/properties/locations"
    ),

  // Public Search & Listings
  listPublic: (params?: {
    page?: number;
    limit?: number;
    category_id?: string;
    category_ids?: string | string[];
    location_id?: string;
    min_price?: number;
    price_min?: number;
    max_price?: number;
    price_max?: number;
    min_bedrooms?: number;
    min_size_sqm?: number;
    search?: string;
    q?: string;
    sort?: "newest" | "price_asc" | "price_desc" | "location" | "relevance";
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    
    // Map category
    const catIds = params?.category_ids || params?.category_id;
    if (catIds) {
      query.set("category_ids", Array.isArray(catIds) ? catIds.join(",") : catIds);
    }
    
    if (params?.location_id) query.set("location_id", params.location_id);
    
    // Map price bounds
    const pMin = params?.price_min ?? params?.min_price;
    if (pMin !== undefined && pMin !== null && !isNaN(pMin)) {
      query.set("price_min", String(pMin));
    }
    const pMax = params?.price_max ?? params?.max_price;
    if (pMax !== undefined && pMax !== null && !isNaN(pMax)) {
      query.set("price_max", String(pMax));
    }
    
    if (params?.min_bedrooms !== undefined && params?.min_bedrooms !== null && params.min_bedrooms > 0) {
      query.set("min_bedrooms", String(params.min_bedrooms));
    }
    if (params?.min_size_sqm !== undefined && params?.min_size_sqm !== null && params.min_size_sqm > 0) {
      query.set("min_size_sqm", String(params.min_size_sqm));
    }
    
    const searchTerm = params?.search || params?.q;
    if (searchTerm?.trim()) {
      query.set("q", searchTerm.trim());
    }
    if (params?.sort) {
      query.set("sort", params.sort);
    }
    // Note: Do not send 'status' because backend publicPropertyListQuerySchema uses .strict() and rejects 'status'.
    const qs = query.toString();
    return apiRequest<{
      properties?: Property[];
      items?: Property[];
      data?: Property[];
      total?: number;
      page?: number;
      limit?: number;
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      message?: string;
    }>(`/api/v1/properties${qs ? `?${qs}` : ""}`);
  },

  getPublic: (propertyId: string) =>
    apiRequest<{ property?: Property; data?: Property; message?: string }>(
      `/api/v1/properties/${propertyId}`
    ),

  compare: (propertyIds: string[]) =>
    apiRequest<{ properties?: Property[]; data?: Property[] }>(
      `/api/v1/properties/compare?ids=${propertyIds.join(",")}`
    ),

  getRecommended: () =>
    apiRequest<{ properties?: Property[]; data?: Property[]; message?: string }>(
      "/api/v1/properties/recommended"
    ),

  // Seller Inventory (Agent & Developer)
  getMyProperties: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      properties?: Property[];
      items?: Property[];
      data?: Property[];
      total?: number;
      page?: number;
      limit?: number;
      pagination?: any;
      message?: string;
    }>(`/api/v1/properties/me${qs ? `?${qs}` : ""}`);
  },

  getMyProperty: (propertyId: string) =>
    apiRequest<{ property?: Property; data?: Property }>(
      `/api/v1/properties/me/${propertyId}`
    ),

  createProperty: (payload: CreatePropertyPayload) =>
    apiRequest<{ message: string; property?: Property; data?: Property }>(
      "/api/v1/properties",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  updateProperty: (propertyId: string, payload: Partial<CreatePropertyPayload>) =>
    apiRequest<{ message: string; property?: Property; data?: Property }>(
      `/api/v1/properties/${propertyId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updatePricing: (propertyId: string, payload: { price: number }) =>
    apiRequest<{ message: string; property?: Property }>(
      `/api/v1/properties/${propertyId}/pricing`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updateStatus: (propertyId: string, payload: { status: "inactive" | "sold" }) =>
    apiRequest<{ message: string; property?: Property }>(
      `/api/v1/properties/${propertyId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  uploadImages: (propertyId: string, formData: FormData) =>
    apiRequest<{ message: string; images?: PropertyImage[] }>(
      `/api/v1/properties/${propertyId}/images`,
      {
        method: "POST",
        body: formData,
      }
    ),

  getImages: (propertyId: string) =>
    apiRequest<{ images?: PropertyImage[]; data?: PropertyImage[] }>(
      `/api/v1/properties/${propertyId}/images`
    ),

  deleteImage: (propertyId: string, imageId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/properties/${propertyId}/images/${imageId}`,
      {
        method: "DELETE",
      }
    ),

  getHistory: (propertyId: string) =>
    apiRequest<{ history?: PropertyHistoryItem[]; data?: PropertyHistoryItem[] }>(
      `/api/v1/properties/${propertyId}/history`
    ),
};

export const propertyAuthApi = {
  listApprovedAgents: () =>
    apiRequest<{ agents?: any[]; items?: any[]; data?: any[] }>("/api/v1/developer/agents"),

  getApprovedAgent: (agentId: string) =>
    apiRequest<{ agent?: any; data?: any }>(`/api/v1/developer/agents/${agentId}`),

  listAuthorizedAgents: (propertyId: string) =>
    apiRequest<{ agents?: any[]; items?: any[]; data?: any[] }>(
      `/api/v1/developer/properties/${propertyId}/agents`
    ),

  authorizeAgent: (propertyId: string, agentId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/developer/properties/${propertyId}/agents`,
      {
        method: "POST",
        body: JSON.stringify({ agentId }),
      }
    ),

  revokeAgent: (propertyId: string, agentId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/developer/properties/${propertyId}/agents/${agentId}`,
      {
        method: "PATCH",
      }
    ),

  listAgentAuthorizedProperties: () =>
    apiRequest<{ properties?: Property[]; items?: any[]; data?: Property[] }>(
      "/api/v1/agent/authorized-properties"
    ),
};

export const referralApi = {
  createReferral: (payload: { propertyId: string; message?: string }) =>
    apiRequest<{ message: string; referral?: Referral; data?: Referral }>(
      "/api/v1/referrals",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getBuyerReferrals: () =>
    apiRequest<{ referrals?: Referral[]; items?: Referral[]; data?: Referral[] }>(
      "/api/v1/referrals/buyer/me"
    ),

  getMyReferrals: () =>
    apiRequest<{ referrals?: Referral[]; items?: Referral[]; data?: Referral[] }>(
      "/api/v1/referrals/me"
    ),

  exportMyReferrals: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/referrals/me/export"),

  respondReferral: (
    referralId: string,
    payload: { decision: "accepted" | "rejected"; reason?: string }
  ) =>
    apiRequest<{ message: string; referral?: Referral }>(
      `/api/v1/referrals/${referralId}/decision`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updateStatus: (
    referralId: string,
    payload: {
      status: "in_progress" | "agreement" | "closed_won" | "closed_lost";
      reason?: string;
    }
  ) =>
    apiRequest<{ message: string; referral?: Referral }>(
      `/api/v1/referrals/${referralId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // Follow-ups & Notes
  createFollowUp: (referralId: string, payload: { notes: string }) =>
    apiRequest<{ message: string; followUp?: ReferralFollowUp }>(
      `/api/v1/referrals/${referralId}/follow-ups`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getFollowUps: (referralId: string) =>
    apiRequest<{ followUps?: ReferralFollowUp[]; data?: ReferralFollowUp[] }>(
      `/api/v1/referrals/${referralId}/follow-ups`
    ),

  // Messaging Thread
  sendMessage: (referralId: string, payload: { message: string }) =>
    apiRequest<{ message: string; messageData?: ReferralMessage }>(
      `/api/v1/referrals/${referralId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getMessages: (referralId: string) =>
    apiRequest<{ messages?: ReferralMessage[]; data?: ReferralMessage[] }>(
      `/api/v1/referrals/${referralId}/messages`
    ),

  // Admin Referral Controls
  getAdminReferrals: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return apiRequest<{
      referrals?: Referral[];
      data?: Referral[];
      pagination?: any;
    }>(`/api/v1/referrals/admin${qs ? `?${qs}` : ""}`);
  },

  getAdminReferralDetails: (referralId: string) =>
    apiRequest<{ referral?: Referral; data?: Referral }>(
      `/api/v1/referrals/admin/${referralId}`
    ),

  reassignReferral: (
    referralId: string,
    payload: { newAssigneeId: string; reason?: string }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/referrals/admin/${referralId}/reassign`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  getReferralHistory: (referralId: string) =>
    apiRequest<{ history?: any[]; data?: any[] }>(
      `/api/v1/referrals/admin/${referralId}/history`
    ),

  exportAdminReferrals: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/referrals/admin/export"),

  // Referral Issues
  reportIssue: (payload: { referral_id?: string; description: string; issue_type?: string }) =>
    apiRequest<{ message: string; issue?: ReferralIssue }>(
      "/api/v1/referral-issues",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getMyIssues: () =>
    apiRequest<{ issues?: ReferralIssue[]; data?: ReferralIssue[] }>(
      "/api/v1/referral-issues/me"
    ),

  getAdminIssues: () =>
    apiRequest<{ issues?: ReferralIssue[]; data?: ReferralIssue[] }>(
      "/api/v1/referral-issues/admin"
    ),

  resolveIssue: (issueId: string, payload: { resolution_note: string; status?: string }) =>
    apiRequest<{ message: string }>(
      `/api/v1/referral-issues/admin/${issueId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const visitApi = {
  createBuyerVisitRequest: (payload: {
    requestedAt: string;
    location?: string;
    notes?: string;
  }) =>
    apiRequest<{ message: string; visit?: PropertyVisit }>(
      "/api/v1/referral/buyer/me/visits",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getBuyerVisits: () =>
    apiRequest<{ visits?: PropertyVisit[]; items?: PropertyVisit[]; data?: any }>(
      "/api/v1/referral/buyer/me/visits"
    ),

  getSellerVisits: (referralId: string) =>
    apiRequest<{ visits?: PropertyVisit[]; items?: PropertyVisit[]; data?: any }>(
      `/api/v1/referral/${referralId}/visits`
    ),

  scheduleVisit: (
    visitId: string,
    payload: { scheduledAt: string; location?: string; notes?: string }
  ) =>
    apiRequest<{ message: string; visit?: PropertyVisit }>(
      `/api/v1/referral/visits/${visitId}/schedule`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updateVisit: (
    visitId: string,
    payload: { scheduledAt?: string; location?: string; notes?: string }
  ) =>
    apiRequest<{ message: string; visit?: PropertyVisit }>(
      `/api/v1/referral/visits/${visitId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  cancelVisit: (visitId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/referral/visits/${visitId}/cancel`,
      {
        method: "PATCH",
      }
    ),

  recordOutcome: (
    visitId: string,
    payload: {
      outcome: "interested" | "not_interested" | "requested_another_visit";
      outcomeNote?: string;
    }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/referral/visits/${visitId}/outcome`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const favoriteApi = {
  add: (propertyId: string) =>
    apiRequest<{ message: string }>("/api/v1/favorites", {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  remove: (propertyId: string) =>
    apiRequest<{ message: string }>(`/api/v1/favorites/${propertyId}`, {
      method: "DELETE",
    }),

  list: () =>
    apiRequest<{ favorites?: FavoriteItem[]; data?: FavoriteItem[] }>(
      "/api/v1/favorites"
    ),
};

export const transactionApi = {
  create: (payload: {
    referralId: string;
    sale_amount: number;
    closing_date: string;
    notes?: string;
  }) =>
    apiRequest<{ message: string; transaction?: Transaction }>(
      "/api/v1/transactions",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return apiRequest<{
      transactions?: Transaction[];
      items?: Transaction[];
      data?: Transaction[];
      total?: number;
      page?: number;
      limit?: number;
      pagination?: any;
    }>(`/api/v1/transactions${qs ? `?${qs}` : ""}`);
  },

  getDetails: (transactionId: string) =>
    apiRequest<{ transaction?: Transaction; data?: Transaction }>(
      `/api/v1/transactions/${transactionId}`
    ),

  update: (
    transactionId: string,
    payload: { sale_amount?: number; closing_date?: string; notes?: string }
  ) =>
    apiRequest<{ message: string; transaction?: Transaction }>(
      `/api/v1/transactions/${transactionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  uploadDocuments: (transactionId: string, formData: FormData) =>
    apiRequest<{ message: string; documents?: TransactionDocument[] }>(
      `/api/v1/transactions/${transactionId}/documents`,
      {
        method: "POST",
        body: formData,
      }
    ),

  getDocuments: (transactionId: string) =>
    apiRequest<{ documents?: TransactionDocument[]; data?: TransactionDocument[] }>(
      `/api/v1/transactions/${transactionId}/documents`
    ),

  decide: (
    transactionId: string,
    payload: { decision: "verified" | "rejected"; reason?: string }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/transactions/${transactionId}/decision`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  export: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/transactions/export"),
};

export const disputeApi = {
  openTransactionDispute: (transactionId: string, payload: { reason: string }) =>
    apiRequest<{ message: string; dispute?: Dispute }>(
      `/api/v1/disputes/${transactionId}/disputes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  listTransactionDisputes: (transactionId: string) =>
    apiRequest<{ disputes?: Dispute[]; data?: Dispute[] }>(
      `/api/v1/disputes/${transactionId}/disputes`
    ),

  openCommissionDispute: (commissionId: string, payload: { reason: string }) =>
    apiRequest<{ message: string; dispute?: Dispute }>(
      `/api/v1/disputes/commissions/${commissionId}/disputes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  listCommissionDisputes: (commissionId: string) =>
    apiRequest<{ disputes?: Dispute[]; data?: Dispute[] }>(
      `/api/v1/disputes/commissions/${commissionId}/disputes`
    ),

  decide: (
    disputeId: string,
    payload: { decision: "resolved" | "rejected"; resolution_note: string }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/disputes/${disputeId}/decision`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const commissionApi = {
  getAgreements: () =>
    apiRequest<{ agreements?: CommissionAgreement[]; data?: CommissionAgreement[] }>(
      "/api/v1/commission-agreements"
    ),

  createAgreement: (payload: {
    sellerId?: string;
    commissionRatePct: number;
    platformSharePct: number;
  }) =>
    apiRequest<{ message: string; agreement?: CommissionAgreement }>(
      "/api/v1/commission-agreements",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  listCommissions: (params?: { status?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return apiRequest<{
      commissions?: Commission[];
      items?: Commission[];
      data?: Commission[];
      summary?: any;
    }>(`/api/v1/commissions${qs ? `?${qs}` : ""}`);
  },

  getStatement: (commissionId: string) =>
    apiRequest<{ commission?: Commission; data?: Commission }>(
      `/api/v1/commissions/${commissionId}`
    ),

  approveCommission: (commissionId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/commissions/${commissionId}/approve`,
      {
        method: "POST",
      }
    ),

  createAdjustment: (commissionId: string, payload: { amount: number; reason: string }) =>
    apiRequest<{ message: string }>(
      `/api/v1/commissions/${commissionId}/adjustments`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  recordPayment: (
    commissionId: string,
    payload: { amount: string; paidOn: string; reference?: string }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/commissions/${commissionId}/payments`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  exportCommissions: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/commissions/export"),
};

export const notificationApi = {
  getUnreadCount: () =>
    apiRequest<{ unreadCount?: number; count?: number; data?: any }>(
      "/api/v1/notifications/unread-count"
    ),

  list: () =>
    apiRequest<{
      notifications?: InAppNotification[];
      data?: InAppNotification[];
    }>("/api/v1/notifications"),

  markRead: (notificationId: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/notifications/${notificationId}/read`,
      {
        method: "PATCH",
      }
    ),

  markAllRead: () =>
    apiRequest<{ message: string }>("/api/v1/notifications/read-all", {
      method: "PATCH",
    }),

  getPreferences: () =>
    apiRequest<{ preferences?: NotificationPreference; data?: NotificationPreference }>(
      "/api/v1/notifications/preferences"
    ),

  updatePreferences: (payload: Partial<NotificationPreference>) =>
    apiRequest<{ message: string; preferences?: NotificationPreference }>(
      "/api/v1/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
};

export const adminManagementApi = {
  getUsers: (params?: { role?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.role) query.set("role", params.role);
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      users?: AdminUser[];
      data?: AdminUser[];
      pagination?: any;
    }>(`/api/v1/admin/users${qs ? `?${qs}` : ""}`);
  },

  getUserById: (id: string) =>
    apiRequest<{ user?: AdminUser; data?: AdminUser }>(`/api/v1/admin/users/${id}`),

  createAdminUser: (payload: { fullName: string; email: string; role: "admin" | "finance_admin" }) =>
    apiRequest<{ message: string; user?: AdminUser }>(
      "/api/v1/admin/users",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  updateUserStatus: (id: string, payload: { status: "approved" | "suspended" | "deactivated" }) =>
    apiRequest<{ message: string }>(
      `/api/v1/admin/users/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  exportUsers: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/admin/users/export"),

  getAuditLogs: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      logs?: AuditLog[];
      data?: AuditLog[];
      pagination?: any;
    }>(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  // Category Management
  createCategory: (payload: { name: string; description?: string }) =>
    apiRequest<{ message: string; category?: PropertyCategory }>(
      "/api/v1/admin/properties/categories",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  updateCategory: (id: string, payload: { name?: string; description?: string; is_active?: boolean }) =>
    apiRequest<{ message: string }>(
      `/api/v1/admin/properties/categories/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // Location Management
  createLocation: (payload: { name: string; sub_city?: string; city?: string }) =>
    apiRequest<{ message: string; location?: PropertyLocation }>(
      "/api/v1/admin/properties/locations",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  updateLocation: (id: string, payload: { name?: string; sub_city?: string; city?: string; is_active?: boolean }) =>
    apiRequest<{ message: string }>(
      `/api/v1/admin/properties/locations/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // Admin Property Review
  getPendingProperties: () =>
    apiRequest<{ properties?: Property[]; data?: Property[] }>(
      "/api/v1/admin/properties"
    ),

  getPendingPropertyById: (propertyId: string) =>
    apiRequest<{ property?: Property; data?: Property }>(
      `/api/v1/admin/properties/${propertyId}`
    ),

  decideProperty: (
    propertyId: string,
    payload: { decision: "approved" | "rejected"; reason?: string }
  ) =>
    apiRequest<{ message: string }>(
      `/api/v1/admin/properties/${propertyId}/decision`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  listAllAdminProperties: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      properties?: Property[];
      data?: Property[];
      pagination?: any;
    }>(`/api/v1/admin/properties/all${qs ? `?${qs}` : ""}`);
  },

  exportAdminProperties: () =>
    apiRequest<{ downloadUrl?: string; data?: any }>("/api/v1/admin/properties/all/export"),
};

export const reportApi = {
  getAgentReport: () =>
    apiRequest<{ report?: AgentReport; data?: AgentReport }>(
      "/api/v1/reports/agent"
    ),

  getDeveloperReport: () =>
    apiRequest<{ report?: DeveloperReport; data?: DeveloperReport }>(
      "/api/v1/reports/developer"
    ),

  getAdminReport: () =>
    apiRequest<{ report?: AdminReport; data?: AdminReport }>(
      "/api/v1/reports/admin"
    ),

  getFinanceAdminReport: () =>
    apiRequest<{ report?: FinanceAdminReport; data?: FinanceAdminReport }>(
      "/api/v1/reports/finance-admin"
    ),
};
