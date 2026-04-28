import { getAccessToken } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api-config";
import { MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH } from "@/lib/enterprise-lookup";
import type {
  CompanyWithRole,
  CompanyRole,
  CompanyListResponse,
  SuperadminCompanyListResponse,
  CreateCompanyData,
  UpdateCompanyData,
  CompanyQueryParams,
  Product,
  ProductListResponse,
  CreateProductData,
  UpdateProductData,
  ProductQueryParams,
  ProductCategory,
  CategoryListResponse,
  CreateCategoryData,
  UpdateCategoryData,
  Client,
  ClientListResponse,
  CreateClientData,
  UpdateClientData,
  ClientQueryParams,
  SirenSearchResult,
  PaginatedSirenSearchResponse,
  // Quotes
  Quote,
  PublicQuote,
  PublicQuoteTerms,
  QuoteListResponse,
  CreateQuoteData,
  UpdateQuoteData,
  QuoteQueryParams,
  SuperadminQuoteQueryParams,
  SignQuoteData,
  SendQuoteData,
  SendQuoteResponse,
  QuoteSignatureDocument,
  LegalDocumentSummary,
  LegalDocumentType,
  LegalDocumentVersion,
  LegalDocumentsResponse,
  PlatformAcceptanceStatus,
  // Invoices
  Invoice,
  InvoiceListResponse,
  InvoiceStats,
  InvoiceStatus,
  CreateInvoiceData,
  UpdateInvoiceData,
  InvoiceQueryParams,
  SuperadminInvoiceQueryParams,
  RecordPaymentData,
  CreateDepositData,
  CancelInvoiceData,
  // Payments
  Payment,
  PaymentListResponse,
  PaymentStats,
  PaymentQueryParams,
  RecordManualPaymentData,
  RefundPaymentData,
  // Reminders
  ReminderSettings,
  EmailTemplate,
  ReminderListResponse,
  ReminderStats,
  UpdateReminderSettingsData,
  SendManualReminderData,
  CreateEmailTemplateData,
  UpdateEmailTemplateData,
  ReminderQueryParams,
  ReminderServiceStatus,
  // Chorus Pro
  ChorusProSettings,
  ChorusProTestConnectionResult,
  ChorusProSubmission,
} from "@/types";

const API_URL = getApiBaseUrl();

/**
 * Interface pour le profil utilisateur
 */
export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  signature_url: string | null;
  created_at: string;
  updated_at: string;
  subscription: {
    id: string;
    plan_name: string;
    plan_slug: string;
    status: string;
    max_companies: number | null;
    current_period_end: string | null;
  } | null;
}

export interface AuthMeResponse {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  provider: string;
  can_invite_superadmin: boolean;
  is_root_superadmin: boolean;
}

/**
 * Interface pour la mise à jour du profil
 */
export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  avatar_url?: string;
  signature_url?: string;
}

/**
 * Interface pour un plan d'abonnement
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_companies: number | null;
  max_quotes_per_month: number | null;
  max_invoices_per_month: number | null;
  max_members: number | null;
  max_storage_mb: number;
  price_per_additional_member: number;
  features: string[];
  stripe_lookup_key_monthly: string | null;
  stripe_lookup_key_yearly: string | null;
  stripe_member_lookup_key: string | null;
}

/**
 * Réponse de GET /subscription/plans (public).
 */
export interface AvailablePlansResponse {
  plans: SubscriptionPlan[];
  stripe_enabled: boolean;
}

/**
 * Interface pour l'abonnement avec les plans
 */
export interface CompanyMember {
  id: string;
  user_id: string;
  role: CompanyRole;
  is_default: boolean;
  created_at: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface CompanyInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface InviteLinkedClientMerchantAdminData {
  email: string;
}

export type LinkedClientMerchantAdminInvitation = CompanyInvitation;

export interface MerchantSignupInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  company_name: string | null;
  siren: string | null;
  city: string | null;
}

export interface InviteNewMerchantAdminData {
  email: string;
  company_name: string;
  siren: string;
  siret?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

export type InviteNewMerchantAdminResponse =
  | {
      status: "existing_merchant";
      merchant_company: { id: string; name: string; siren: string | null };
    }
  | {
      status: "invited";
      invitation_id: string;
      email: string;
    };

export interface MembersQuota {
  max_members: number | null;
  current_members: number;
  pending_invitations: number;
}

export interface InviteValidationResponse {
  email: string;
  role:
    | "merchant_admin"
    | "merchant_consultant"
    | "accountant"
    | "accountant_consultant"
    | "superadmin";
  invitation_type: "member" | "accountant_firm" | "merchant_signup";
  company_id: string;
  company_name: string;
  inviter_name: string;
  expires_at: string;
  invited_firm_name?: string | null;
  invited_firm_siren?: string | null;
  signup_company_name?: string | null;
  signup_siren?: string | null;
  signup_siret?: string | null;
  signup_address?: string | null;
  signup_postal_code?: string | null;
  signup_city?: string | null;
  signup_country?: string | null;
}

export interface InviteAccountantFirmData {
  firm_name: string;
  siren: string;
  email: string;
}

export interface RegistrationAvailabilityResponse {
  available: boolean;
  message?: string;
  supportEmail?: string;
}

export type InviteAccountantFirmResponse =
  | {
      status: "existing_accountant";
      accountant_company: { id: string; name: string; siren: string | null };
    }
  | {
      status: "invited";
      invitation_id: string;
      email: string;
    };

export interface AccountantLinkRequestCompanySummary {
  id: string;
  name: string;
  legal_name: string | null;
  siren: string | null;
  email: string | null;
  city: string | null;
  logo_url: string | null;
}

export interface AccountantLinkRequest {
  id: string;
  accountant_company_id: string;
  merchant_company_id: string;
  request_origin: "existing_merchant" | "new_client_invitation";
  requested_by: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
  accountant_company: AccountantLinkRequestCompanySummary;
  merchant_company: AccountantLinkRequestCompanySummary;
}

export interface SubscriptionWithPlans {
  subscription: {
    id: string;
    user_id: string;
    plan_id: string | null;
    status: string;
    billing_period: string;
    stripe_subscription_id: string | null;
    stripe_base_item_id: string | null;
    current_period_end: string | null;
    extra_members_quantity: number;
    plan: SubscriptionPlan | null;
  } | null;
  available_plans: SubscriptionPlan[];
  scope: "self" | "owner" | "none";
  company_id: string | null;
  owner_user_id: string | null;
  company_owner_role: "merchant_admin" | "accountant" | null;
  /** Entreprise cliente liée au cabinet (même règle de facturation que l'espace comptable). */
  is_company_linked_to_accountant_cabinet: boolean;
  is_invited_merchant_admin: boolean;
  can_manage_billing: boolean;
  has_any_active_company_subscription: boolean;
  usage: {
    invoices_this_month: number;
    quotes_this_month: number;
    total_members: number;
    extra_members: number;
    pending_invitations: number;
    billable_members: number;
    billable_extra_members: number;
  };
}

export interface ChangeSubscriptionResponse {
  subscription: SubscriptionWithPlans["subscription"];
  client_secret: string | null;
  status: string;
}

export interface RegistrationPaymentPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_creation_mode?: "create" | "join_only";
  company_name: string;
  siren: string;
  siret?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  team_size?: string;
  role: "merchant_admin";
  accountant_siren?: string;
  plan_slug: string;
  billing_period: "monthly" | "yearly";
  promotion_code?: string;
  platform_legal_accepted_at: string;
}

export interface RegistrationPricing {
  original_amount_ht: number;
  discount_amount_ht: number;
  final_amount_ht: number;
  currency: string;
  promotion_code: string | null;
  coupon_name: string | null;
  coupon_percent_off: number | null;
  coupon_amount_off: number | null;
}

export interface RegistrationPaymentResponse {
  registration_session_id: string;
  subscription_id: string;
  client_secret: string;
  status: string;
  pricing: RegistrationPricing;
}

export interface ValidateRegistrationPromotionPayload {
  plan_slug: string;
  billing_period: "monthly" | "yearly";
  promotion_code: string;
}

export interface ValidateRegistrationPromotionResponse {
  pricing: RegistrationPricing;
}

export interface ValidateSubscriptionPromotionPayload {
  plan_slug: string;
  billing_period: "monthly" | "yearly";
  promotion_code: string;
}

export interface ValidateSubscriptionPromotionResponse {
  pricing: RegistrationPricing;
}

export interface FinalizeRegistrationPaymentResponse {
  status: "completed" | "processing";
  message: string;
}

export interface PendingCompanySummary {
  name: string;
  legal_name: string | null;
  siren: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  source_accountant_company_id: string | null;
  accountant_company_name: string | null;
}

export interface PendingCompanyPaymentSessionSummary {
  session_id: string;
  status: string;
  plan_slug: string | null;
  billing_period: "monthly" | "yearly" | null;
  company_summary: PendingCompanySummary;
  finalized_company_id: string | null;
  company: CompanyWithRole | null;
}

export interface CreatePendingCompanySubscriptionPayload {
  session_id?: string;
  company_data?: CreateCompanyData;
  plan_slug?: string;
  billing_period?: "monthly" | "yearly";
  promotion_code?: string;
}

export interface CreatePendingCompanySubscriptionResponse {
  session_id: string;
  subscription_id: string | null;
  client_secret: string | null;
  status: string;
  pricing: RegistrationPricing | null;
  company_summary: PendingCompanySummary;
}

export interface ValidatePendingCompanyPromotionPayload {
  session_id: string;
  plan_slug: string;
  billing_period: "monthly" | "yearly";
  promotion_code: string;
}

export interface ValidatePendingCompanyPromotionResponse {
  pricing: RegistrationPricing;
}

export interface FinalizePendingCompanySubscriptionResponse {
  status: "completed" | "processing";
  message: string;
  company: CompanyWithRole | null;
}

function normalizePlanFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Handle JSON array stored as string.
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch {
        // Ignore parse errors and continue with fallback.
      }
    }

    // Handle Postgres text[] shape: {"a","b","c"}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

function normalizeSubscriptionPlan(plan: SubscriptionPlan): SubscriptionPlan {
  return {
    ...plan,
    features: normalizePlanFeatures(
      (plan as unknown as { features?: unknown }).features,
    ),
  };
}

const SERVICE_UNAVAILABLE_MESSAGE =
  "Le service est temporairement indisponible. Réessayez dans quelques instants.";
const COMMUNICATION_ERROR_MESSAGE =
  "Une erreur de communication est survenue. Réessayez dans quelques instants.";
const SESSION_EXPIRED_MESSAGE =
  "Votre session a expiré. Connectez-vous à nouveau pour continuer.";

function containsTechnicalDetails(message: string): boolean {
  return [
    /supabase/i,
    /stripe/i,
    /vite_[a-z0-9_]+/i,
    /html/i,
    /json/i,
    /api/i,
    /requesturl/i,
    /content-type/i,
    /sql/i,
    /database/i,
    /base de donn[ée]es/i,
    /migration/i,
    /backend/i,
    /duplicate key/i,
    /unique constraint/i,
    /constraint/i,
  ].some((pattern) => pattern.test(message));
}

function sanitizeUiErrorMessage(
  message: string | string[] | undefined,
  fallback: string,
): string {
  const normalizedMessage = Array.isArray(message)
    ? message.find(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    : message;
  const trimmed = normalizedMessage?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (containsTechnicalDetails(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function getResponseFallbackMessage(status: number): string {
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (status >= 500) {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  return COMMUNICATION_ERROR_MESSAGE;
}

function parseRetryAfterSeconds(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

  const parsedSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
    return parsedSeconds;
  }

  const parsedDate = Date.parse(retryAfter);
  if (!Number.isNaN(parsedDate)) {
    const seconds = Math.ceil((parsedDate - Date.now()) / 1000);
    if (seconds > 0) {
      return seconds;
    }
  }

  return null;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Fait une requête authentifiée vers l'API
 */
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const requestUrl = `${API_URL}/api${endpoint}`;
  const response = await fetch(requestUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Handle empty responses (204 No Content)
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined;
  }
  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();

  if (!response.ok) {
    let message = getResponseFallbackMessage(response.status);
    if (contentType.includes("application/json") && rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as { message?: string | string[] };
        message = sanitizeUiErrorMessage(
          parsed?.message,
          getResponseFallbackMessage(response.status),
        );
      } catch {
        // Keep fallback message.
      }
    }
    throw new ApiRequestError(
      message,
      response.status,
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  }

  if (!rawBody) {
    return undefined;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      throw new Error(COMMUNICATION_ERROR_MESSAGE);
    }
  }

  if (
    contentType.includes("text/html") ||
    rawBody.trim().startsWith("<!DOCTYPE")
  ) {
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }

  throw new Error(COMMUNICATION_ERROR_MESSAGE);
}

async function fetchWithoutAuth(endpoint: string, options: RequestInit = {}) {
  const requestUrl = `${API_URL}/api${endpoint}`;
  const response = await fetch(requestUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();

  if (!response.ok) {
    let message = getResponseFallbackMessage(response.status);
    if (contentType.includes("application/json") && rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as { message?: string | string[] };
        message = sanitizeUiErrorMessage(
          parsed?.message,
          getResponseFallbackMessage(response.status),
        );
      } catch {
        // Keep fallback message.
      }
    }
    throw new ApiRequestError(
      message,
      response.status,
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  }

  if (!rawBody) {
    return undefined;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      throw new Error(COMMUNICATION_ERROR_MESSAGE);
    }
  }

  throw new Error(COMMUNICATION_ERROR_MESSAGE);
}

/**
 * Service utilisateur
 */
export const userService = {
  /**
   * Récupère le profil de l'utilisateur connecté
   */
  async getProfile(): Promise<UserProfile> {
    return fetchWithAuth("/user/profile");
  },

  /**
   * Met à jour le profil de l'utilisateur
   */
  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    return fetchWithAuth("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère les entreprises de l'utilisateur
   */
  async getCompanies() {
    return fetchWithAuth("/user/companies");
  },
};

/**
 * Service abonnement
 */
export const subscriptionService = {
  async getSubscriptionWithPlans(
    companyId?: string,
  ): Promise<SubscriptionWithPlans> {
    const headers: Record<string, string> = {};
    if (companyId) headers["X-Company-Id"] = companyId;
    const response = (await fetchWithAuth("/subscription", {
      headers,
    })) as SubscriptionWithPlans;
    return {
      ...response,
      subscription: response.subscription
        ? {
            ...response.subscription,
            plan: response.subscription.plan
              ? normalizeSubscriptionPlan(response.subscription.plan)
              : null,
          }
        : null,
      available_plans: response.available_plans.map(normalizeSubscriptionPlan),
    };
  },

  async getPlans(): Promise<AvailablePlansResponse> {
    const response = await fetch(`${API_URL}/api/subscription/plans`);
    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des plans");
    }
    const data = (await response.json()) as {
      plans?: SubscriptionPlan[];
      stripe_enabled?: boolean;
    };
    const rawPlans = Array.isArray(data) ? data : data.plans;
    const plans = (rawPlans ?? []).map(normalizeSubscriptionPlan);
    const stripe_enabled =
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data) &&
      typeof data.stripe_enabled === "boolean"
        ? data.stripe_enabled
        : true;
    return { plans, stripe_enabled };
  },

  async changePlan(
    planSlug: string,
    billingPeriod?: "monthly" | "yearly",
    companyId?: string,
  ): Promise<ChangeSubscriptionResponse> {
    const headers: Record<string, string> = {};
    if (companyId) headers["X-Company-Id"] = companyId;

    const response = (await fetchWithAuth("/subscription/change", {
      method: "POST",
      headers,
      body: JSON.stringify({
        plan_slug: planSlug,
        billing_period: billingPeriod,
      }),
    })) as ChangeSubscriptionResponse;

    return {
      ...response,
      subscription: response.subscription
        ? {
            ...response.subscription,
            plan: response.subscription.plan
              ? normalizeSubscriptionPlan(response.subscription.plan)
              : null,
          }
        : null,
    };
  },

  async subscribe(
    planSlug: string,
    billingPeriod: "monthly" | "yearly",
    promotionCode?: string,
    companyId?: string,
  ): Promise<{
    subscription_id: string;
    client_secret: string | null;
    status: string;
  }> {
    const headers: Record<string, string> = {};
    if (companyId) headers["X-Company-Id"] = companyId;

    return fetchWithAuth("/subscription/subscribe", {
      method: "POST",
      headers,
      body: JSON.stringify({
        plan_slug: planSlug,
        billing_period: billingPeriod,
        promotion_code: promotionCode,
      }),
    });
  },

  async validateSubscriptionPromotion(
    payload: ValidateSubscriptionPromotionPayload,
  ): Promise<ValidateSubscriptionPromotionResponse> {
    return fetchWithAuth("/subscription/promo/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createPendingCompanySubscription(
    payload: CreatePendingCompanySubscriptionPayload,
  ): Promise<CreatePendingCompanySubscriptionResponse> {
    return fetchWithAuth("/subscription/company-creation", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getPendingCompanyPaymentSession(
    sessionId: string,
  ): Promise<PendingCompanyPaymentSessionSummary> {
    return fetchWithAuth(`/subscription/company-creation/${sessionId}`);
  },

  async validatePendingCompanyPromotion(
    payload: ValidatePendingCompanyPromotionPayload,
  ): Promise<ValidatePendingCompanyPromotionResponse> {
    return fetchWithAuth("/subscription/company-creation/promo/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async finalizePendingCompanySubscription(
    sessionId: string,
  ): Promise<FinalizePendingCompanySubscriptionResponse> {
    return fetchWithAuth("/subscription/company-creation/finalize", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  async createBillingPortalSession(companyId?: string): Promise<{ url: string }> {
    const headers: Record<string, string> = {};
    if (companyId) headers["X-Company-Id"] = companyId;

    return fetchWithAuth("/subscription/billing-portal", {
      method: "POST",
      headers,
    });
  },

  async createRegistrationPayment(
    payload: RegistrationPaymentPayload,
  ): Promise<RegistrationPaymentResponse> {
    return fetchWithoutAuth("/subscription/registration", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async validateRegistrationPromotion(
    payload: ValidateRegistrationPromotionPayload,
  ): Promise<ValidateRegistrationPromotionResponse> {
    return fetchWithoutAuth("/subscription/registration/promo/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async finalizeRegistrationPayment(
    registrationSessionId: string,
  ): Promise<FinalizeRegistrationPaymentResponse> {
    return fetchWithoutAuth("/subscription/registration/finalize", {
      method: "POST",
      body: JSON.stringify({ registration_session_id: registrationSessionId }),
    });
  },
};

export const authService = {
  async getMe(): Promise<AuthMeResponse> {
    return fetchWithAuth("/auth/me");
  },

  async checkRegistrationAvailability(params: {
    siren?: string;
    siret?: string;
    role?:
      | "merchant_admin"
      | "merchant_consultant"
      | "accountant"
      | "accountant_consultant"
      | "superadmin";
    country?: string;
  }): Promise<RegistrationAvailabilityResponse> {
    const queryParams = new URLSearchParams();
    if (params.siren) queryParams.set("siren", params.siren);
    if (params.siret) queryParams.set("siret", params.siret);
    if (params.role) queryParams.set("role", params.role);
    if (params.country) queryParams.set("country", params.country);

    return fetchWithoutAuth(
      `/auth/registration-availability?${queryParams.toString()}`,
    );
  },
};

export const superadminService = {
  async getCompanies(
    params?: CompanyQueryParams,
  ): Promise<SuperadminCompanyListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(`/superadmin/companies${query ? `?${query}` : ""}`);
  },

  async searchCompanies(
    search?: string,
  ): Promise<SuperadminCompanyListResponse> {
    return this.getCompanies({
      search,
      page: 1,
      limit: 20,
    });
  },

  async getQuotes(
    params?: SuperadminQuoteQueryParams,
  ): Promise<QuoteListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.company_id) queryParams.append("company_id", params.company_id);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(`/superadmin/quotes${query ? `?${query}` : ""}`);
  },

  async getQuoteById(quoteId: string): Promise<Quote> {
    return fetchWithAuth(`/superadmin/quotes/${quoteId}`);
  },

  async downloadQuotePdf(quoteId: string): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/superadmin/quotes/${quoteId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }

    return response.blob();
  },

  async getInvoices(
    params?: SuperadminInvoiceQueryParams,
  ): Promise<InvoiceListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.type) queryParams.append("type", params.type);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.company_id) queryParams.append("company_id", params.company_id);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.overdue_only) queryParams.append("overdue_only", "true");

    const query = queryParams.toString();
    return fetchWithAuth(`/superadmin/invoices${query ? `?${query}` : ""}`);
  },

  async getInvoiceById(invoiceId: string): Promise<Invoice> {
    return fetchWithAuth(`/superadmin/invoices/${invoiceId}`);
  },

  async downloadInvoicePdf(invoiceId: string): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/superadmin/invoices/${invoiceId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }

    return response.blob();
  },

  async getCreditNotes(
    params?: SuperadminInvoiceQueryParams,
  ): Promise<InvoiceListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.company_id) queryParams.append("company_id", params.company_id);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.overdue_only) queryParams.append("overdue_only", "true");

    const query = queryParams.toString();
    return fetchWithAuth(`/superadmin/credit-notes${query ? `?${query}` : ""}`);
  },

  async getCreditNoteById(invoiceId: string): Promise<Invoice> {
    return fetchWithAuth(`/superadmin/credit-notes/${invoiceId}`);
  },

  async downloadCreditNotePdf(invoiceId: string): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/superadmin/credit-notes/${invoiceId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }

    return response.blob();
  },
};

export const legalService = {
  async getPlatformAcceptanceStatus(): Promise<PlatformAcceptanceStatus> {
    return fetchWithAuth("/legal-documents/platform/status");
  },

  async acceptCurrentPlatformDocuments(): Promise<PlatformAcceptanceStatus> {
    return fetchWithAuth("/legal-documents/platform/accept-current", {
      method: "POST",
    });
  },

  async getCompanyDocuments(
    companyId: string,
  ): Promise<LegalDocumentsResponse> {
    return fetchWithAuth(`/companies/${companyId}/legal-documents`);
  },

  async saveCompanyDocument(
    companyId: string,
    documentType: Extract<LegalDocumentType, "sales_terms">,
    data: { title?: string; content_text: string },
  ): Promise<{
    document: LegalDocumentSummary;
    version: LegalDocumentVersion;
  }> {
    return fetchWithAuth(
      `/companies/${companyId}/legal-documents/${documentType}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },
};

/**
 * Service image upload
 */
export const imageService = {
  /**
   * Upload une image
   */
  async upload(
    file: File,
  ): Promise<{
    success: boolean;
    url: string;
    fileName: string;
    size: number;
  }> {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("Non authentifié");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/api/images/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Erreur ${response.status}`);
    }

    return response.json();
  },
};

/**
 * Service entreprises (CRUD complet)
 */
export const companyService = {
  /**
   * Récupère la liste des entreprises de l'utilisateur
   */
  async getAll(params?: CompanyQueryParams): Promise<CompanyListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const queryString = queryParams.toString();
    return fetchWithAuth(`/companies${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Récupère une entreprise par son ID
   */
  async getById(id: string): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}`);
  },

  /**
   * Récupère l'entreprise par défaut
   */
  async getDefault(): Promise<CompanyWithRole | null> {
    return fetchWithAuth("/companies/default");
  },

  /**
   * Crée une nouvelle entreprise
   */
  async create(data: CreateCompanyData): Promise<CompanyWithRole> {
    return fetchWithAuth("/companies", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour une entreprise
   */
  async update(id: string, data: UpdateCompanyData): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Supprime une entreprise
   */
  async delete(id: string): Promise<{ message: string }> {
    return fetchWithAuth(`/companies/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Définit une entreprise comme entreprise par défaut
   */
  async setDefault(id: string): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/set-default`, {
      method: "POST",
    });
  },

  // ============================================
  // Méthodes de mise à jour par section
  // ============================================

  /**
   * Met à jour les informations générales (name, legal_name, siren, vat_number)
   */
  async updateGeneral(
    id: string,
    data: {
      name?: string;
      legal_name?: string;
      siren?: string;
      vat_number?: string;
      logo_url?: string;
    },
  ): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/general`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour les coordonnées (email, phone, website, address, city, postal_code, country)
   */
  async updateContact(
    id: string,
    data: {
      email?: string;
      phone?: string;
      website?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    },
  ): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/contact`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour les informations bancaires (rib_iban, rib_bic, rib_bank_name)
   */
  async updateBanking(
    id: string,
    data: {
      rib_iban?: string;
      rib_bic?: string;
      rib_bank_name?: string;
    },
  ): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/banking`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour les paramètres (default_vat_rate, default_payment_terms, etc.)
   */
  async updateSettings(
    id: string,
    data: {
      default_vat_rate?: number;
      default_payment_terms?: number;
      quote_validity_days?: number;
      terms_and_conditions?: string;
      quote_footer?: string;
      invoice_footer?: string;
    },
  ): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/settings`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Accountant linking
  async linkAccountant(
    id: string,
    accountantCompanyId: string,
  ): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/link-accountant`, {
      method: "POST",
      body: JSON.stringify({ accountant_company_id: accountantCompanyId }),
    });
  },

  async unlinkAccountant(id: string): Promise<CompanyWithRole> {
    return fetchWithAuth(`/companies/${id}/link-accountant`, {
      method: "DELETE",
    });
  },

  async getLinkedClients(id: string): Promise<any[]> {
    return fetchWithAuth(`/companies/${id}/linked-clients`);
  },

  async inviteNewMerchantAdmin(
    companyId: string,
    data: InviteNewMerchantAdminData,
  ): Promise<InviteNewMerchantAdminResponse> {
    return fetchWithAuth(`/companies/${companyId}/invite-new-merchant-admin`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMerchantSignupInvitations(
    companyId: string,
  ): Promise<MerchantSignupInvitation[]> {
    return fetchWithAuth(`/companies/${companyId}/merchant-signup-invitations`);
  },

  async cancelMerchantSignupInvitation(
    companyId: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    return fetchWithAuth(
      `/companies/${companyId}/merchant-signup-invitations/${invitationId}`,
      {
        method: "DELETE",
      },
    );
  },

  async getLinkedClientMerchantAdminInvitations(
    companyId: string,
    clientId: string,
  ): Promise<LinkedClientMerchantAdminInvitation[]> {
    return fetchWithAuth(
      `/companies/${companyId}/linked-clients/${clientId}/merchant-admin-invitations`,
    );
  },

  async inviteLinkedClientMerchantAdmin(
    companyId: string,
    clientId: string,
    data: InviteLinkedClientMerchantAdminData,
  ): Promise<any> {
    return fetchWithAuth(
      `/companies/${companyId}/linked-clients/${clientId}/invite-merchant-admin`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async cancelLinkedClientMerchantAdminInvitation(
    companyId: string,
    clientId: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    return fetchWithAuth(
      `/companies/${companyId}/linked-clients/${clientId}/merchant-admin-invitations/${invitationId}`,
      {
        method: "DELETE",
      },
    );
  },

  async searchAccountants(
    query: string,
  ): Promise<{ id: string; name: string; siren: string | null }[]> {
    return fetchWithAuth(
      `/companies/search-accountants?q=${encodeURIComponent(query)}`,
    );
  },

  async searchMerchants(
    companyId: string,
    query: string,
  ): Promise<AccountantLinkRequestCompanySummary[]> {
    return fetchWithAuth(
      `/companies/${companyId}/search-merchants?q=${encodeURIComponent(query)}`,
    );
  },

  async inviteAccountantFirm(
    id: string,
    data: InviteAccountantFirmData,
  ): Promise<InviteAccountantFirmResponse> {
    return fetchWithAuth(`/companies/${id}/invite-accountant-firm`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAccountantLinkRequests(
    companyId: string,
    direction: "incoming" | "outgoing",
  ): Promise<AccountantLinkRequest[]> {
    return fetchWithAuth(
      `/companies/${companyId}/accountant-link-requests?direction=${direction}`,
    );
  },

  async createAccountantLinkRequest(
    companyId: string,
    merchantCompanyId: string,
  ): Promise<AccountantLinkRequest> {
    return fetchWithAuth(`/companies/${companyId}/accountant-link-requests`, {
      method: "POST",
      body: JSON.stringify({ merchant_company_id: merchantCompanyId }),
    });
  },

  async acceptAccountantLinkRequest(
    companyId: string,
    requestId: string,
  ): Promise<AccountantLinkRequest> {
    return fetchWithAuth(
      `/companies/${companyId}/accountant-link-requests/${requestId}/accept`,
      {
        method: "POST",
      },
    );
  },

  async rejectAccountantLinkRequest(
    companyId: string,
    requestId: string,
  ): Promise<AccountantLinkRequest> {
    return fetchWithAuth(
      `/companies/${companyId}/accountant-link-requests/${requestId}/reject`,
      {
        method: "POST",
      },
    );
  },

  async getLinkedClientDocuments(
    companyId: string,
    clientId: string,
    params: {
      type: AccountantDocumentType;
      page?: number;
      limit?: number;
      year?: number;
      period?: AccountantDocumentPeriod;
      statuses?: AccountantDocumentStatus[];
    },
  ): Promise<PaginatedDocuments> {
    const queryParams = new URLSearchParams();
    queryParams.append("type", params.type);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.year) queryParams.append("year", params.year.toString());
    if (params.period) queryParams.append("period", params.period);
    params.statuses?.forEach((status) =>
      queryParams.append("statuses", status),
    );
    return fetchWithAuth(
      `/companies/${companyId}/linked-clients/${clientId}/documents?${queryParams.toString()}`,
    );
  },

  async downloadLinkedClientDocumentsZip(
    companyId: string,
    clientId: string,
    params: {
      document_ids?: string[];
      type: AccountantDocumentType;
      year?: number;
      period?: AccountantDocumentPeriod;
      statuses?: AccountantDocumentStatus[];
    },
  ): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/companies/${companyId}/linked-clients/${clientId}/documents/download-zip`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      let message =
        "Erreur lors du téléchargement groupé des documents comptables";
      const contentType = response.headers.get("content-type") || "";
      const rawBody = await response.text().catch(() => "");
      if (contentType.includes("application/json") && rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as { message?: string };
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // Ignore parse error and keep fallback message.
        }
      }
      throw new Error(message);
    }

    return response.blob();
  },

  async downloadLinkedClientDocument(
    companyId: string,
    clientId: string,
    documentId: string,
  ): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/companies/${companyId}/linked-clients/${clientId}/documents/${documentId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du document comptable");
    }

    return response.blob();
  },

  // Member management
  async getMembers(
    id: string,
  ): Promise<{
    members: CompanyMember[];
    invitations: CompanyInvitation[];
    quota: MembersQuota | null;
  }> {
    return fetchWithAuth(`/companies/${id}/members`);
  },

  async inviteMember(id: string, email: string, role: string): Promise<any> {
    return fetchWithAuth(`/companies/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },

  async removeMember(
    id: string,
    memberId: string,
  ): Promise<{ message: string }> {
    return fetchWithAuth(`/companies/${id}/members/${memberId}`, {
      method: "DELETE",
    });
  },

  async updateMemberRole(
    id: string,
    memberId: string,
    role: CompanyRole,
  ): Promise<{ message: string }> {
    return fetchWithAuth(`/companies/${id}/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async finalizeInvitation(
    id: string,
    invitationId: string,
  ): Promise<any> {
    return fetchWithAuth(`/companies/${id}/invitations/${invitationId}/finalize`, {
      method: "POST",
    });
  },

  async resendInvitation(
    id: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    return fetchWithAuth(`/companies/${id}/invitations/${invitationId}/resend`, {
      method: "POST",
    });
  },

  async cancelInvitation(
    id: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    return fetchWithAuth(`/companies/${id}/invitations/${invitationId}`, {
      method: "DELETE",
    });
  },
};

export const inviteService = {
  async validateToken(token: string): Promise<InviteValidationResponse> {
    const response = await fetch(`${API_URL}/api/invites/${token}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Erreur ${response.status}`);
    }

    return response.json();
  },
};

/**
 * Service produits (CRUD par entreprise)
 */
export const productService = {
  /**
   * Récupère la liste des produits d'une entreprise
   */
  async getAll(
    companyId: string,
    params?: ProductQueryParams,
  ): Promise<ProductListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.is_active !== undefined)
      queryParams.append("is_active", params.is_active.toString());
    if (params?.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params?.sort_order) queryParams.append("sort_order", params.sort_order);

    const queryString = queryParams.toString();
    return fetchWithAuth(
      `/companies/${companyId}/products${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Récupère un produit par son ID
   */
  async getById(companyId: string, productId: string): Promise<Product> {
    return fetchWithAuth(`/companies/${companyId}/products/${productId}`);
  },

  /**
   * Crée un nouveau produit
   */
  async create(companyId: string, data: CreateProductData): Promise<Product> {
    return fetchWithAuth(`/companies/${companyId}/products`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour un produit
   */
  async update(
    companyId: string,
    productId: string,
    data: UpdateProductData,
  ): Promise<Product> {
    return fetchWithAuth(`/companies/${companyId}/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Active ou désactive un produit
   */
  async toggleActive(
    companyId: string,
    productId: string,
    isActive: boolean,
  ): Promise<Product> {
    return fetchWithAuth(
      `/companies/${companyId}/products/${productId}/toggle-active`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      },
    );
  },

  /**
   * Supprime un produit
   */
  async delete(companyId: string, productId: string): Promise<void> {
    return fetchWithAuth(`/companies/${companyId}/products/${productId}`, {
      method: "DELETE",
    });
  },

  /**
   * Duplique un produit existant
   */
  async duplicate(companyId: string, productId: string): Promise<Product> {
    return fetchWithAuth(
      `/companies/${companyId}/products/${productId}/duplicate`,
      {
        method: "POST",
      },
    );
  },
};

/**
 * Service catégories de produits
 */
export const categoryService = {
  /**
   * Récupère la liste des catégories d'une entreprise
   */
  async getAll(
    companyId: string,
    search?: string,
  ): Promise<CategoryListResponse> {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);

    const queryString = queryParams.toString();
    return fetchWithAuth(
      `/companies/${companyId}/categories${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Récupère une catégorie par son ID
   */
  async getById(
    companyId: string,
    categoryId: string,
  ): Promise<ProductCategory> {
    return fetchWithAuth(`/companies/${companyId}/categories/${categoryId}`);
  },

  /**
   * Crée une nouvelle catégorie
   */
  async create(
    companyId: string,
    data: CreateCategoryData,
  ): Promise<ProductCategory> {
    return fetchWithAuth(`/companies/${companyId}/categories`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Trouve ou crée une catégorie par son nom
   */
  async findOrCreate(
    companyId: string,
    name: string,
  ): Promise<ProductCategory> {
    return fetchWithAuth(`/companies/${companyId}/categories/find-or-create`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Met à jour une catégorie
   */
  async update(
    companyId: string,
    categoryId: string,
    data: UpdateCategoryData,
  ): Promise<ProductCategory> {
    return fetchWithAuth(`/companies/${companyId}/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Supprime une catégorie
   */
  async delete(companyId: string, categoryId: string): Promise<void> {
    return fetchWithAuth(`/companies/${companyId}/categories/${categoryId}`, {
      method: "DELETE",
    });
  },

  /**
   * Récupère le nombre de produits dans une catégorie
   */
  async getProductCount(
    companyId: string,
    categoryId: string,
  ): Promise<{ count: number }> {
    return fetchWithAuth(
      `/companies/${companyId}/categories/${categoryId}/products-count`,
    );
  },
};

/**
 * Service clients
 */
export const clientService = {
  /**
   * Récupère la liste des clients d'une entreprise
   */
  async getAll(
    companyId: string,
    params?: ClientQueryParams,
  ): Promise<ClientListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.type) queryParams.append("type", params.type);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const queryString = queryParams.toString();
    return fetchWithAuth(
      `/companies/${companyId}/clients${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Récupère un client par son ID
   */
  async getById(companyId: string, clientId: string): Promise<Client> {
    return fetchWithAuth(`/companies/${companyId}/clients/${clientId}`);
  },

  /**
   * Crée un nouveau client
   */
  async create(companyId: string, data: CreateClientData): Promise<Client> {
    return fetchWithAuth(`/companies/${companyId}/clients`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour un client
   */
  async update(
    companyId: string,
    clientId: string,
    data: UpdateClientData,
  ): Promise<Client> {
    return fetchWithAuth(`/companies/${companyId}/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Supprime un client
   */
  async delete(companyId: string, clientId: string): Promise<void> {
    return fetchWithAuth(`/companies/${companyId}/clients/${clientId}`, {
      method: "DELETE",
    });
  },

  /**
   * Duplique un client existant
   */
  async duplicate(companyId: string, clientId: string): Promise<Client> {
    return fetchWithAuth(
      `/companies/${companyId}/clients/${clientId}/duplicate`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Vérifie l'éligibilité Chorus Pro d'un client public
   */
  async verifyChorus(companyId: string, clientId: string): Promise<Client> {
    return fetchWithAuth(
      `/companies/${companyId}/clients/${clientId}/chorus-pro/verify`,
      {
        method: "POST",
      },
    );
  },
};

/**
 * Service de recherche SIREN
 */
export const sirenService = {
  /**
   * Recherche unifiée (authentifiée).
   * Détecte automatiquement SIREN (9 chiffres), SIRET (14 chiffres) ou texte.
   */
  async lookup(
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<SirenSearchResult[]> {
    const queryParams = new URLSearchParams();
    queryParams.append("q", query);
    if (limit) queryParams.append("limit", limit.toString());
    return fetchWithAuth(`/siren/lookup?${queryParams.toString()}`, { signal });
  },

  /**
   * Recherche unifiée publique (sans authentification, max 5 résultats).
   * Détecte automatiquement SIREN, SIRET ou texte.
   */
  async publicLookup(
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<SirenSearchResult[]> {
    if (!query || query.trim().length < MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH) {
      return [];
    }
    const queryParams = new URLSearchParams();
    queryParams.append("q", query.trim());
    if (limit) queryParams.append("limit", Math.min(limit, 5).toString());
    return fetchWithoutAuth(`/siren/public-lookup?${queryParams.toString()}`, {
      signal,
    });
  },

  async lookupPaged(
    query: string,
    limit?: number,
    cursor?: string | null,
    signal?: AbortSignal,
  ): Promise<PaginatedSirenSearchResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append("q", query);
    if (limit) queryParams.append("limit", limit.toString());
    if (cursor) queryParams.append("cursor", cursor);
    return fetchWithAuth(`/siren/lookup-paged?${queryParams.toString()}`, {
      signal,
    });
  },

  async publicLookupPaged(
    query: string,
    limit?: number,
    cursor?: string | null,
    signal?: AbortSignal,
  ): Promise<PaginatedSirenSearchResponse> {
    if (!query || query.trim().length < MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH) {
      return {
        items: [],
        total: 0,
        limit: Math.min(limit || 10, 25),
        nextCursor: null,
        hasMore: false,
      };
    }
    const queryParams = new URLSearchParams();
    queryParams.append("q", query.trim());
    if (limit) queryParams.append("limit", Math.min(limit, 25).toString());
    if (cursor) queryParams.append("cursor", cursor);
    return fetchWithoutAuth(`/siren/public-lookup-paged?${queryParams.toString()}`, {
      signal,
    });
  },
};

// ============================================
// SERVICE DEVIS (QUOTES)
// ============================================

export const quoteService = {
  /**
   * Crée un nouveau devis
   */
  async create(companyId: string, data: CreateQuoteData): Promise<Quote> {
    return fetchWithAuth(`/companies/${companyId}/quotes`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère la liste des devis
   */
  async getAll(
    companyId: string,
    params?: QuoteQueryParams,
  ): Promise<QuoteListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(
      `/companies/${companyId}/quotes${query ? `?${query}` : ""}`,
    );
  },

  /**
   * Récupère un devis par ID
   */
  async getById(companyId: string, quoteId: string): Promise<Quote> {
    return fetchWithAuth(`/companies/${companyId}/quotes/${quoteId}`);
  },

  /**
   * Met à jour un devis
   */
  async update(
    companyId: string,
    quoteId: string,
    data: UpdateQuoteData,
  ): Promise<Quote> {
    return fetchWithAuth(`/companies/${companyId}/quotes/${quoteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Supprime un devis
   */
  async delete(companyId: string, quoteId: string): Promise<void> {
    return fetchWithAuth(`/companies/${companyId}/quotes/${quoteId}`, {
      method: "DELETE",
    });
  },

  /**
   * Duplique un devis
   */
  async duplicate(companyId: string, quoteId: string): Promise<Quote> {
    return fetchWithAuth(
      `/companies/${companyId}/quotes/${quoteId}/duplicate`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Envoie un devis au client
   */
  async send(
    companyId: string,
    quoteId: string,
    data?: SendQuoteData,
  ): Promise<SendQuoteResponse> {
    return fetchWithAuth(`/companies/${companyId}/quotes/${quoteId}/send`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * Convertit un devis en facture
   */
  async convert(companyId: string, quoteId: string): Promise<Invoice> {
    return fetchWithAuth(`/companies/${companyId}/quotes/${quoteId}/convert`, {
      method: "POST",
    });
  },

  /**
   * Télécharge le PDF d'un devis
   */
  async downloadPdf(companyId: string, quoteId: string): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/companies/${companyId}/quotes/${quoteId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }
    return response.blob();
  },

  async getSignatureDocuments(
    companyId: string,
    quoteId: string,
  ): Promise<QuoteSignatureDocument[]> {
    return fetchWithAuth(
      `/companies/${companyId}/quotes/${quoteId}/signature-documents`,
    );
  },

  async downloadSignatureDocument(
    companyId: string,
    quoteId: string,
    documentId: string,
  ): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_URL}/api/companies/${companyId}/quotes/${quoteId}/signature-documents/${documentId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du document de signature");
    }

    return response.blob();
  },

  // Routes publiques (sans auth)
  /**
   * Récupère les infos d'un devis pour signature (public)
   */
  async getForSignature(token: string): Promise<PublicQuote> {
    const response = await fetch(`${API_URL}/api/quotes/sign/${token}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur");
    }
    return response.json();
  },

  async getTermsSnapshot(token: string): Promise<PublicQuoteTerms> {
    const response = await fetch(`${API_URL}/api/quotes/sign/${token}/terms`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur");
    }
    return response.json();
  },

  /**
   * Signe un devis (public)
   */
  async sign(
    token: string,
    data: SignQuoteData,
  ): Promise<{ quote: PublicQuote; invoice_id: string; message: string }> {
    const response = await fetch(`${API_URL}/api/quotes/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur");
    }
    return response.json();
  },

  /**
   * Refuse un devis (public)
   */
  async refuse(
    token: string,
    reason?: string,
  ): Promise<{ quote: PublicQuote; message: string }> {
    const response = await fetch(`${API_URL}/api/quotes/refuse/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur");
    }
    return response.json();
  },

  /**
   * Télécharge le PDF public d'un devis
   */
  async downloadPublicPdf(token: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/quotes/pdf/${token}`);
    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }
    return response.blob();
  },
};

// ============================================
// SERVICE FACTURES (INVOICES)
// ============================================

export const invoiceService = {
  /**
   * Crée une nouvelle facture
   */
  async create(companyId: string, data: CreateInvoiceData): Promise<Invoice> {
    return fetchWithAuth(`/invoices`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère la liste des factures
   */
  async getAll(
    companyId: string,
    params?: InvoiceQueryParams,
  ): Promise<InvoiceListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append("search", params.search);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.type) queryParams.append("type", params.type);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(`/invoices${query ? `?${query}` : ""}`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Récupère les statistiques des factures
   */
  async getStats(
    companyId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<InvoiceStats> {
    const queryParams = new URLSearchParams();
    if (fromDate) queryParams.append("from_date", fromDate);
    if (toDate) queryParams.append("to_date", toDate);

    const query = queryParams.toString();
    return fetchWithAuth(`/invoices/stats${query ? `?${query}` : ""}`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Récupère une facture par ID
   */
  async getById(companyId: string, invoiceId: string): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Met à jour une facture
   */
  async update(
    companyId: string,
    invoiceId: string,
    data: UpdateInvoiceData,
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Supprime une facture
   */
  async delete(companyId: string, invoiceId: string): Promise<void> {
    return fetchWithAuth(`/invoices/${invoiceId}`, {
      method: "DELETE",
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Envoie une facture au client
   */
  async send(
    companyId: string,
    invoiceId: string,
  ): Promise<{ success: boolean; view_url: string; warnings?: string[] }> {
    return fetchWithAuth(`/invoices/${invoiceId}/send`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Enregistre un paiement sur une facture
   */
  async recordPayment(
    companyId: string,
    invoiceId: string,
    data: RecordPaymentData,
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère les paiements d'une facture
   */
  async getPayments(companyId: string, invoiceId: string): Promise<Payment[]> {
    return fetchWithAuth(`/invoices/${invoiceId}/payments`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Crée une facture d'acompte
   */
  async createDeposit(
    companyId: string,
    invoiceId: string,
    data: CreateDepositData,
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}/deposit`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Annule une facture
   */
  async cancel(
    companyId: string,
    invoiceId: string,
    data: CancelInvoiceData,
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}/cancel`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Crée un avoir pour une facture
   */
  async createCreditNote(
    companyId: string,
    invoiceId: string,
    data: { reason: string; amount?: number },
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}/credit-note`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Télécharge le PDF d'une facture
   */
  async downloadPdf(companyId: string, invoiceId: string): Promise<Blob> {
    const token = await getAccessToken();
    const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Company-Id": companyId,
      },
    });
    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }
    return response.blob();
  },

  /**
   * Renvoyer l'email de la facture
   */
  async resendEmail(
    companyId: string,
    invoiceId: string,
  ): Promise<{ success: boolean; message: string; warning?: string }> {
    return fetchWithAuth(`/invoices/${invoiceId}/resend`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Envoyer une relance de paiement
   */
  async sendReminder(
    companyId: string,
    invoiceId: string,
    data?: { level?: number; custom_message?: string; include_pdf?: boolean },
  ): Promise<{ success: boolean; message: string; warning?: string }> {
    return fetchWithAuth(`/invoices/${invoiceId}/reminder`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * Marquer une facture comme payée
   */
  async markAsPaid(
    companyId: string,
    invoiceId: string,
    data?: { payment_method?: string; reference?: string; notes?: string },
  ): Promise<Invoice> {
    return fetchWithAuth(`/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data || {}),
    });
  },

  // Routes publiques
  /**
   * Récupère les infos d'une facture (public)
   */
  async getPublic(token: string): Promise<Invoice> {
    const response = await fetch(`${API_URL}/api/invoices/view/${token}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur");
    }
    return response.json();
  },

  /**
   * Télécharge le PDF public d'une facture
   */
  async downloadPublicPdf(token: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/invoices/pdf/${token}`);
    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du PDF");
    }
    return response.blob();
  },
};

// ============================================
// SERVICE PAIEMENTS (PAYMENTS)
// ============================================

export const paymentService = {
  /**
   * Enregistre un paiement manuel
   */
  async recordManual(
    companyId: string,
    data: RecordManualPaymentData,
  ): Promise<Payment> {
    return fetchWithAuth(`/payments/manual`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Rembourse un paiement
   */
  async refund(
    companyId: string,
    data: RefundPaymentData,
  ): Promise<{ success: boolean; refund_id?: string }> {
    return fetchWithAuth(`/payments/refund`, {
      method: "POST",
      headers: { "X-Company-Id": companyId },
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère la liste des paiements
   */
  async getAll(
    companyId: string,
    params?: PaymentQueryParams,
  ): Promise<PaymentListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.invoice_id) queryParams.append("invoice_id", params.invoice_id);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.payment_method)
      queryParams.append("payment_method", params.payment_method);
    if (params?.from_date) queryParams.append("from_date", params.from_date);
    if (params?.to_date) queryParams.append("to_date", params.to_date);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(`/payments${query ? `?${query}` : ""}`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  /**
   * Récupère les statistiques de paiement
   */
  async getStats(
    companyId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<PaymentStats> {
    const queryParams = new URLSearchParams();
    if (fromDate) queryParams.append("from_date", fromDate);
    if (toDate) queryParams.append("to_date", toDate);

    const query = queryParams.toString();
    return fetchWithAuth(`/payments/stats${query ? `?${query}` : ""}`, {
      headers: { "X-Company-Id": companyId },
    });
  },
};

// ============================================
// SERVICE RAPPELS (REMINDERS)
// ============================================

export const reminderService = {
  /**
   * Récupère les paramètres de rappel
   */
  async getSettings(companyId: string): Promise<ReminderSettings> {
    return fetchWithAuth(`/companies/${companyId}/reminders/settings`);
  },

  /**
   * Met à jour les paramètres de rappel
   */
  async updateSettings(
    companyId: string,
    data: UpdateReminderSettingsData,
  ): Promise<ReminderSettings> {
    return fetchWithAuth(`/companies/${companyId}/reminders/settings`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère les templates d'email
   */
  async getTemplates(companyId: string): Promise<EmailTemplate[]> {
    return fetchWithAuth(`/companies/${companyId}/reminders/templates`);
  },

  /**
   * Crée un template d'email
   */
  async createTemplate(
    companyId: string,
    data: CreateEmailTemplateData,
  ): Promise<EmailTemplate> {
    return fetchWithAuth(`/companies/${companyId}/reminders/templates`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Met à jour un template d'email
   */
  async updateTemplate(
    companyId: string,
    templateId: string,
    data: UpdateEmailTemplateData,
  ): Promise<EmailTemplate> {
    return fetchWithAuth(
      `/companies/${companyId}/reminders/templates/${templateId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  /**
   * Supprime un template d'email
   */
  async deleteTemplate(companyId: string, templateId: string): Promise<void> {
    return fetchWithAuth(
      `/companies/${companyId}/reminders/templates/${templateId}`,
      {
        method: "DELETE",
      },
    );
  },

  /**
   * Envoie un rappel manuel
   */
  async sendManual(
    companyId: string,
    data: SendManualReminderData,
  ): Promise<{
    success: boolean;
    email_sent?: boolean;
    sms_sent?: boolean;
    errors?: string[];
  }> {
    return fetchWithAuth(`/companies/${companyId}/reminders/send`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Récupère l'historique des rappels
   */
  async getAll(
    companyId: string,
    params?: ReminderQueryParams,
  ): Promise<ReminderListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.invoice_id) queryParams.append("invoice_id", params.invoice_id);
    if (params?.quote_id) queryParams.append("quote_id", params.quote_id);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.channel) queryParams.append("channel", params.channel);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    return fetchWithAuth(
      `/companies/${companyId}/reminders${query ? `?${query}` : ""}`,
    );
  },

  /**
   * Récupère les statistiques des rappels
   */
  async getStats(companyId: string): Promise<ReminderStats> {
    return fetchWithAuth(`/companies/${companyId}/reminders/stats`);
  },

  /**
   * Vérifie le statut des services de notification
   */
  async getStatus(companyId: string): Promise<ReminderServiceStatus> {
    return fetchWithAuth(`/companies/${companyId}/reminders/status`);
  },
};

export interface DashboardStats {
  company: {
    total_revenue: number;
    total_paid: number;
    total_pending: number;
    total_overdue: number;
    revenue_vs_previous: number;
    invoice_count: number;
    average_invoice: number;
    quotes_sent: number;
    quotes_accepted: number;
    conversion_rate: number;
    pending_quotes_amount: number;
    credit_notes_count: number;
    credit_notes_amount: number;
    monthly_revenue: { month: string; amount: number }[];
    top_overdue_clients: { name: string; amount: number; days: number }[];
  };
  accounting: {
    total_vat: number;
    vat_by_rate: { rate: number; amount: number }[];
    vat_on_credit_notes: number;
    invoices_draft: number;
    invoices_sent: number;
    invoices_paid: number;
    invoices_overdue: number;
    credit_notes_count: number;
    invoices_without_vat: number;
  };
}

export interface AccountantDashboardStats {
  client_count: number;
  total_annual_revenue: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  overdue_count: number;
  monthly_revenue: { month: string; amount: number }[];
}

export interface LinkedClientWithStats {
  id: string;
  name: string;
  siren: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
  stats: {
    invoice_count: number;
    quote_count: number;
    credit_note_count: number;
    annual_revenue: number;
    total_paid: number;
    overdue_count: number;
    overdue_amount: number;
    pending_amount: number;
  };
}

export type AccountantDocumentType = "invoices" | "credit-notes";
export type AccountantDocumentPeriod =
  | "year"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "m01"
  | "m02"
  | "m03"
  | "m04"
  | "m05"
  | "m06"
  | "m07"
  | "m08"
  | "m09"
  | "m10"
  | "m11"
  | "m12";

export interface AccountantDocument {
  id: string;
  invoice_number: string;
  total: number;
  status: AccountantDocumentStatus;
  issue_date: string | null;
  created_at: string;
  type: string | null;
  document_kind: "invoice" | "credit_note";
  is_immutable: boolean;
  storage_available: boolean;
  stored_document_id: string | null;
  downloadable_filename: string | null;
}

export interface PaginatedDocuments {
  data: AccountantDocument[];
  total: number;
  downloadable_total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type AccountantDocumentStatus = Extract<
  InvoiceStatus,
  "sent" | "paid" | "overdue" | "cancelled"
>;

export const chorusProService = {
  async getSettings(companyId: string): Promise<ChorusProSettings | null> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro`);
  },

  async updateSettings(
    companyId: string,
    data: Partial<ChorusProSettings>,
  ): Promise<ChorusProSettings> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async testConnection(
    companyId: string,
    data?: { cpro_login?: string; cpro_password?: string },
  ): Promise<ChorusProTestConnectionResult> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro/test`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },

  async searchStructure(companyId: string, identifiant: string): Promise<any> {
    return fetchWithAuth(
      `/companies/${companyId}/chorus-pro/search-structure`,
      {
        method: "POST",
        body: JSON.stringify({ identifiant }),
      },
    );
  },

  async submitInvoice(
    invoiceId: string,
    data: {
      codeDestinataire: string;
      codeServiceExecutant?: string;
      numeroEngagement?: string;
      cadreFacturation: string;
    },
  ): Promise<ChorusProSubmission> {
    return fetchWithAuth(`/invoices/${invoiceId}/chorus-pro/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getSubmissionStatus(
    invoiceId: string,
  ): Promise<ChorusProSubmission | null> {
    return fetchWithAuth(`/invoices/${invoiceId}/chorus-pro/status`);
  },

  async searchSentInvoices(
    companyId: string,
    params: Record<string, any>,
  ): Promise<any> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro/search-sent`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async searchReceivedInvoices(
    companyId: string,
    params: Record<string, any>,
  ): Promise<any> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro/search-received`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getReceivedInvoiceDetail(
    companyId: string,
    idFacture: number,
  ): Promise<any> {
    return fetchWithAuth(
      `/companies/${companyId}/chorus-pro/received/${idFacture}`,
      {
        method: "POST",
      },
    );
  },

  async downloadInvoices(
    companyId: string,
    ids: number[],
    format: string = "PDF",
  ): Promise<any> {
    return fetchWithAuth(`/companies/${companyId}/chorus-pro/download`, {
      method: "POST",
      body: JSON.stringify({ ids, format }),
    });
  },
};

export const dashboardService = {
  async getStats(companyId: string, year?: number): Promise<DashboardStats> {
    const query = year ? `?year=${year}` : "";
    return fetchWithAuth(`/dashboard/stats${query}`, {
      headers: { "X-Company-Id": companyId },
    });
  },

  async getAccountantStats(
    companyId: string,
    year?: number,
  ): Promise<AccountantDashboardStats> {
    const query = year ? `?year=${year}` : "";
    return fetchWithAuth(`/dashboard/accountant-stats${query}`, {
      headers: { "X-Company-Id": companyId },
    });
  },
};
