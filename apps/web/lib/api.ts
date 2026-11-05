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
