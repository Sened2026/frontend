import { User, Session } from "@supabase/supabase-js";

/**
 * Types pour la base de données Supabase
 * À étendre selon votre schéma
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Omit<UserProfile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserProfile, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

/**
 * Profil utilisateur stocké dans la base de données
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Context d'authentification
 */
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  canInviteSuperadmin: boolean;
  isRootSuperadmin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    metadata:
      | string
      | {
          full_name: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          company_name?: string;
          siren?: string;
          address?: string;
          postal_code?: string;
          city?: string;
          country?: string;
          team_size?: string;
          plan_slug?: string;
          role?:
            | "merchant_admin"
            | "merchant_consultant"
            | "accountant"
            | "accountant_consultant"
            | "superadmin";
          accountant_siren?: string;
          platform_legal_accepted_at?: string;
        },
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Réponse d'upload d'image
 */
export interface ImageUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  size: number;
}

/**
 * Erreur API
 */
export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

/**
 * Résumé du cabinet comptable lié
 */
export interface AccountantFirmSummary {
  id: string;
  name: string;
  legal_name: string | null;
  siren: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
}

export type AccountantLinkStatus = 'none' | 'linked' | 'invite_pending';
export type CompanyOwnerRole = "merchant_admin" | "accountant";

/**
 * Types pour les entreprises
 */
export interface Company {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  siren: string | null;
  vat_number: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  rib_iban: string | null;
  rib_bic: string | null;
  rib_bank_name: string | null;
  is_vat_exempt: boolean;
  vat_exemption_note: string | null;
  default_vat_rate: number;
  default_payment_terms: number;
  terms_and_conditions: string | null;
  quote_validity_days: number;
  quote_footer: string | null;
  invoice_footer: string | null;
  company_owner_role: CompanyOwnerRole;
  accountant_company_id: string | null;
  accountant_firm_summary: AccountantFirmSummary | null;
  accountant_link_status: AccountantLinkStatus;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export type CompanyRole =
  | "merchant_admin"
  | "merchant_consultant"
  | "accountant"
  | "accountant_consultant"
  | "superadmin";

export interface CompanyWithRole extends Company {
  role: CompanyRole;
  is_default: boolean;
}

export interface CompanyListResponse {
  companies: CompanyWithRole[];
  total: number;
  owned_total: number;
}

export interface SuperadminCompanySummary {
  id: string;
  name: string;
  legal_name: string | null;
  siren: string | null;
  city: string | null;
  country: string;
  logo_url: string | null;
  created_at: string;
}

export interface SuperadminCompanyListResponse {
  companies: SuperadminCompanySummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCompanyData {
  name: string;
  owner_role?: "merchant_admin" | "accountant";
  source_accountant_company_id?: string;
  legal_name?: string;
  siren?: string;
  vat_number?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  rib_iban?: string;
  rib_bic?: string;
  rib_bank_name?: string;
  is_vat_exempt?: boolean;
  vat_exemption_note?: string;
  default_vat_rate?: number;
  default_payment_terms?: number;
  terms_and_conditions?: string;
  quote_validity_days?: number;
  quote_footer?: string;
  invoice_footer?: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {}

export interface CompanyQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Types pour les produits
 */
export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

export interface ProductCategory {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProductTaxLine {
  label?: string;
  amount: number;
  tax_rate: number;
  position: number;
}

export interface Product {
  id: string;
  company_id: string;
  reference: string | null;
  name: string;
  description: string | null;
  unit_id: string | null;
  category_id: string | null;
  unit_price: number;
  vat_rate: number;
  has_multi_tax: boolean;
  tax_lines?: ProductTaxLine[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  unit?: Unit | null;
  category?: ProductCategory | null;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductData {
  reference?: string;
  name: string;
  description?: string;
  unit_id?: string;
  category_id?: string;
  unit_price: number;
  vat_rate?: number;
  is_active?: boolean;
  has_multi_tax?: boolean;
  tax_lines?: ProductTaxLine[];
}

export interface UpdateProductData extends Partial<CreateProductData> {}

export interface ProductQueryParams {
  search?: string;
  page?: number;
  limit?: number;
  is_active?: boolean;
  category_id?: string;
  sort_by?: "name" | "reference" | "unit_price" | "created_at";
  sort_order?: "asc" | "desc";
}

export interface CategoryListResponse {
  categories: ProductCategory[];
  total: number;
}

export interface CreateCategoryData {
  name: string;
  color?: string;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
}

/**
 * Types pour les clients
 */
export type ClientType = "individual" | "professional";
export type ClientSector = "private" | "public";
export type ChorusEligibilityStatus =
  | "unchecked"
  | "eligible"
  | "ineligible"
  | "error";

export interface Client {
  id: string;
  company_id: string;
  type: ClientType;
  client_sector: ClientSector | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  siret: string | null;
  siren: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  signature_contact_first_name: string | null;
  signature_contact_last_name: string | null;
  signature_contact_email: string | null;
  signature_contact_phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  notes: string | null;
  // Chorus Pro: valeurs par défaut soumission
  chorus_pro_code_destinataire: string | null;
  chorus_pro_cadre_facturation: string | null;
  chorus_pro_code_service_executant: string | null;
  chorus_pro_numero_engagement: string | null;
  // Chorus Pro: éligibilité (géré par verify-chorus)
  chorus_pro_eligibility_status: ChorusEligibilityStatus;
  chorus_pro_structure_id: number | null;
  chorus_pro_structure_label: string | null;
  chorus_pro_service_code_required: boolean | null;
  chorus_pro_engagement_required: boolean | null;
  chorus_pro_services: ChorusProVerifiedService[] | null;
  chorus_pro_last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateClientData {
  type: ClientType;
  client_sector?: ClientSector;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  siret?: string;
  siren?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  signature_contact_first_name?: string;
  signature_contact_last_name?: string;
  signature_contact_email?: string;
  signature_contact_phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
  chorus_pro_code_destinataire?: string;
  chorus_pro_cadre_facturation?: string;
  chorus_pro_code_service_executant?: string;
  chorus_pro_numero_engagement?: string;
}

export interface UpdateClientData extends Partial<CreateClientData> {}

export interface ClientQueryParams {
  search?: string;
  type?: ClientType;
  page?: number;
  limit?: number;
}

/**
 * Types pour la recherche SIREN
 */
export interface SirenSearchResult {
  siren: string;
  siret: string;
  company_name: string;
  vat_number: string;
  address: string;
  postal_code: string;
  city: string;
  country_code?: string;
  legal_form: string;
  naf_code: string;
  creation_date: string;
}

export interface PaginatedSirenSearchResponse {
  items: SirenSearchResult[];
  total: number;
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================
// TYPES POUR LES DEVIS
// ============================================

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "signed"
  | "refused"
  | "expired"
  | "converted";

export type QuoteSignatureProvider = "internal" | "yousign";

export interface QuoteItem {
  id?: string;
  product_id?: string;
  reference?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  vat_rate: number;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  line_total: number;
  total_ht?: number;
  position: number;
  product?: Product;
}

export interface Quote {
  id: string;
  company_id: string;
  client_id: string;
  quote_number: string;
  status: QuoteStatus;
  issue_date: string;
  validity_date: string;
  subject?: string;
  notes?: string;
  terms_and_conditions?: string;
  legal_document_version_id?: string | null;
  legal_document_version_number?: number | null;
  terms_checksum_sha256?: string | null;
  subtotal: number;
  total_vat: number;
  total: number;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  deposit_percent?: number;
  deposit_amount?: number;
  signature_token?: string;
  signature_provider: QuoteSignatureProvider;
  yousign_signature_request_id?: string | null;
  yousign_document_id?: string | null;
  yousign_signer_id?: string | null;
  yousign_status?: string | null;
  yousign_signature_link_expires_at?: string | null;
  yousign_last_event_name?: string | null;
  yousign_last_event_at?: string | null;
  signed_at?: string;
  signed_by?: string;
  signature_ip?: string;
  refused_at?: string;
  refusal_reason?: string;
  converted_invoice_id?: string;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
  client?: Client;
  company?: Company;
}

export interface PublicQuote extends Quote {
  items: QuoteItem[];
  client: Client;
  company: Company;
  is_signature_link_expired: boolean;
  can_sign: boolean;
  can_refuse: boolean;
  can_start_signature: boolean;
  has_terms_snapshot: boolean;
  terms_public_url: string | null;
}

export interface PublicQuoteTerms {
  quote_number: string;
  company: {
    name: string | null;
    legal_name?: string | null;
  } | null;
  has_terms_snapshot: boolean;
  legal_document_version_number: number | null;
  terms_and_conditions: string | null;
  terms_checksum_sha256: string | null;
}

export interface QuoteListResponse {
  quotes: Quote[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateQuoteData {
  client_id: string;
  issue_date?: string;
  validity_date?: string;
  subject?: string;
  notes?: string;
  terms_and_conditions?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  items: Omit<QuoteItem, "id" | "line_total">[];
}

export interface UpdateQuoteData extends Partial<CreateQuoteData> {}

export interface QuoteQueryParams {
  search?: string;
  status?: QuoteStatus;
  client_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface SuperadminQuoteQueryParams extends QuoteQueryParams {
  company_id?: string;
}

export interface SignQuoteData {
  signer_name: string;
  signer_email: string;
  cgv_accepted?: boolean;
  consent_accepted: boolean;
}

export interface SendQuoteData {
  confirm_send_without_cgv?: boolean;
}

export interface SendQuoteResponse {
  quote: Quote;
  public_url: string;
  warnings: string[];
}

export interface StartQuoteSignatureResponse {
  redirect_url: string;
  expires_at: string | null;
}

export type QuoteSignatureDocumentKind = 'signed_quote' | 'audit_trail';

export interface QuoteSignatureDocument {
  id: string;
  filename: string;
  mime_type: string;
  created_at: string;
  kind: QuoteSignatureDocumentKind;
}

// ============================================
// TYPES POUR LES DOCUMENTS LÉGAUX
// ============================================

export type LegalDocumentType =
  | "platform_cgv"
  | "privacy_policy"
  | "legal_notice"
  | "sales_terms";

export interface LegalDocumentVersion {
  id: string;
  legal_document_id: string;
  version_number: number;
  title: string;
  content_text: string;
  content_format: "plain_text";
  checksum_sha256: string;
  is_published: boolean;
  published_at: string | null;
  source_kind: "manual" | "quote_snapshot";
  quote_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegalDocumentSummary {
  id: string;
  scope: "platform" | "company";
  company_id: string | null;
  document_type: LegalDocumentType;
  slug: string;
  title: string;
  is_required: boolean;
  default_content: string;
  published_version: LegalDocumentVersion | null;
  latest_draft_version: LegalDocumentVersion | null;
  latest_version: LegalDocumentVersion | null;
}

export interface LegalDocumentsResponse {
  can_manage_platform?: boolean;
  can_manage_company?: boolean;
  documents: LegalDocumentSummary[];
}

export interface PlatformAcceptanceStatus {
  requires_acceptance: boolean;
  accepted_at: string | null;
}

// ============================================
// TYPES POUR LES FACTURES
// ============================================

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type InvoiceType = "invoice" | "deposit" | "credit_note";

export interface InvoiceItem {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  line_total: number;
  position: number;
  product?: Product;
}

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string;
  quote_id?: string;
  parent_invoice_id?: string;
  invoice_number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subject?: string;
  notes?: string;
  terms_and_conditions?: string;
  subtotal: number;
  total_vat: number;
  total: number;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  amount_paid: number;
  deposit_percent?: number;
  view_token?: string;
  sent_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  created_at: string;
  updated_at: string;
  has_credit_note?: boolean;
  linked_credit_note_id?: string | null;
  linked_credit_note_number?: string | null;
  items?: InvoiceItem[];
  client?: Client;
  company?: Company;
  quote?: Quote;
  payments?: Payment[];
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InvoiceStats {
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  count_draft: number;
  count_sent: number;
  count_paid: number;
  count_overdue: number;
  total_invoiced_breakdown: {
    base_amount: number;
    cancelled_deduction: number;
    credit_notes_correction: number;
    final_amount: number;
  };
  total_paid_breakdown: {
    base_amount: number;
    cancelled_deduction: number;
    credit_notes_correction: number;
    final_amount: number;
  };
}

export interface CreateInvoiceData {
  client_id: string;
  quote_id?: string;
  type?: InvoiceType;
  issue_date?: string;
  due_date?: string;
  subject?: string;
  notes?: string;
  terms_and_conditions?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  items: Omit<InvoiceItem, "id" | "line_total">[];
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {}

export interface InvoiceQueryParams {
  search?: string;
  status?: InvoiceStatus;
  type?: InvoiceType;
  client_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  overdue_only?: boolean;
}

export interface SuperadminInvoiceQueryParams extends InvoiceQueryParams {
  company_id?: string;
}

export interface RecordPaymentData {
  amount: number;
  payment_method: PaymentMethod;
  paid_at?: string;
  reference?: string;
  notes?: string;
}

export interface CreateDepositData {
  deposit_percent: number;
}

export interface CancelInvoiceData {
  reason: string;
  create_credit_note?: boolean;
  credit_note_amount?: number;
}

// ============================================
// TYPES POUR LES PAIEMENTS
// ============================================

export type PaymentMethod =
  | "card"
  | "bank_transfer"
  | "cash"
  | "check"
  | "other";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string;
  reference?: string;
  notes?: string;
  created_at: string;
  invoice?: Invoice;
}

export interface PaymentListResponse {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentStats {
  total_received: number;
  total_pending: number;
  total_refunded: number;
  count_by_method: Record<string, number>;
}

export interface PaymentQueryParams {
  invoice_id?: string;
  client_id?: string;
  status?: PaymentStatus;
  payment_method?: PaymentMethod;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface RecordManualPaymentData {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  paid_at?: string;
  reference?: string;
  notes?: string;
}

export interface RefundPaymentData {
  payment_id: string;
  amount?: number;
  reason?: string;
}

// ============================================
// TYPES POUR LES RAPPELS
// ============================================

export type ReminderType = "before_due" | "after_due" | "quote_expiring";
export type ReminderChannel = "email" | "sms" | "both";
export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";

export interface ReminderRule {
  days_offset: number;
  channel: ReminderChannel;
  email_template_id?: string;
  sms_template?: string;
}

export interface ReminderSettings {
  id: string;
  company_id: string;
  enabled: boolean;
  invoice_rules: ReminderRule[];
  quote_rules: ReminderRule[];
  sender_email?: string;
  sender_name?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  type: ReminderType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  company_id: string;
  invoice_id?: string;
  quote_id?: string;
  client_id: string;
  type: ReminderType;
  channel: ReminderChannel;
  status: ReminderStatus;
  level?: 1 | 2 | 3 | null;
  scheduled_at: string;
  sent_at?: string;
  error_message?: string;
  email_message_id?: string;
  sms_message_id?: string;
  created_at: string;
}

export interface ReminderListResponse {
  reminders: Reminder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReminderStats {
  total_sent: number;
  total_pending: number;
  total_failed: number;
  sent_by_channel: Record<string, number>;
  sent_by_type: Record<string, number>;
}

export interface UpdateReminderSettingsData {
  enabled?: boolean;
  invoice_rules?: ReminderRule[];
  quote_rules?: ReminderRule[];
  sender_email?: string;
  sender_name?: string;
}

export interface SendManualReminderData {
  document_id: string;
  document_type: "invoice" | "quote";
  channel: ReminderChannel;
  custom_message?: string;
  custom_subject?: string;
}

export interface CreateEmailTemplateData {
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  type: ReminderType;
}

export interface UpdateEmailTemplateData {
  name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
}

export interface ReminderQueryParams {
  invoice_id?: string;
  quote_id?: string;
  client_id?: string;
  status?: ReminderStatus;
  channel?: ReminderChannel;
  page?: number;
  limit?: number;
}

export interface ReminderServiceStatus {
  email_configured: boolean;
  sms_configured: boolean;
}

// ============================================
// TYPES POUR CHORUS PRO
// ============================================

export interface ChorusProSettings {
  id: string;
  company_id: string;
  enabled: boolean;
  cpro_login: string | null;
  cpro_password: string | null;
  id_structure_cpp: number | null;
  chorus_id_utilisateur_courant: number | null;
  chorus_id_fournisseur: number | null;
  chorus_id_service_fournisseur: number | null;
  chorus_code_coordonnees_bancaires_fournisseur: number | null;
  connection_status: "not_configured" | "connected" | "error";
  default_code_destinataire: string | null;
  default_code_service_executant: string | null;
  default_cadre_facturation: string | null;
  verified_company_siret: string | null;
  verified_structure_label: string | null;
  verified_user_role: string | null;
  verified_user_status: string | null;
  verified_attachment_status: string | null;
  verified_services: ChorusProVerifiedService[] | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChorusProVerifiedService {
  codeService: string | null;
  libelleService: string | null;
  actif: boolean;
  statutService: string | null;
  statutRattachementService: string | null;
}

export interface ChorusProMatchedStructure {
  companySiret: string;
  idStructureCpp: number | null;
  identifiantStructure: string;
  structureLabel: string | null;
  userRole: string | null;
  userStatus: string | null;
  attachmentStatus: string | null;
  services: ChorusProVerifiedService[];
}

export interface ChorusProTestConnectionResult {
  success: boolean;
  message: string;
  matchedStructure: ChorusProMatchedStructure | null;
}

export interface ChorusProSubmission {
  id: string;
  company_id: string;
  invoice_id: string;
  mode_depot: string | null;
  piece_jointe_id: number | null;
  identifiant_facture_cpp: number | null;
  numero_facture_chorus: string | null;
  statut_chorus: string | null;
  submitted_at: string;
  submitted_by: string;
  deposit_response: any;
  deposit_error_message: string | null;
  submission_response: any;
  last_status_check_at: string | null;
  last_status_response: any;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
