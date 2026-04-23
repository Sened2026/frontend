import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Crown,
  ArrowLeft,
  Edit,
  Trash2,
  Star,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  Globe,
  CreditCard,
  FileText,
  Settings,
  Loader2,
  Calendar,
  Percent,
  Clock,
  Check,
  Building,
  Hash,
  Users,
  UserPlus,
  Shield,
  AlertTriangle,
  Calculator,
  Search,
  LinkIcon,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { ImageUpload } from "@/components/ImageUpload";
import { PaymentForm } from "@/components/PaymentForm";
import {
  companyService,
  subscriptionService,
  type CompanyMember,
  type CompanyInvitation,
  type MembersQuota,
  type SubscriptionWithPlans,
  type AccountantLinkRequest,
} from "@/services/api";
import type { CompanyWithRole, CompanyRole } from "@/types";
import { EnterpriseLookupField } from "@/components/shared/EnterpriseLookupField";
import { getRoleLabel, usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import type { SirenSearchResult } from "@/types";

// Types pour les données de chaque section
type GeneralData = {
  name: string;
  legal_name: string;
  siren: string;
  vat_number: string;
  logo_url: string;
};

type ContactData = {
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
};

type BankingData = {
  rib_iban: string;
  rib_bic: string;
  rib_bank_name: string;
};

type SettingsData = {
  default_vat_rate: number;
  is_vat_exempt: boolean;
  vat_exemption_note: string;
  default_payment_terms: number;
  quote_validity_days: number;
  terms_and_conditions: string;
  quote_footer: string;
  invoice_footer: string;
};

type InviteConfirmationPayload = {
  email: string;
  role: string;
};

type InviteSubscriptionSummary = {
  planName: string;
  billingPeriod: "monthly" | "yearly";
  activeMembers: number;
  pendingInvitations: number;
  currentBillableMembers: number;
  currentBillableExtraMembers: number;
  projectedBillableMembers: number;
  projectedBillableExtraMembers: number;
  addonPriceMonthlyHt: number;
  canManageBilling: boolean;
  scope: SubscriptionWithPlans["scope"];
};

// Type pour la section en cours d'édition
type EditingSection = "general" | "contact" | "banking" | "settings" | null;
type CompanyTab =
  | "general"
  | "contact"
  | "banking"
  | "settings"
  | "members"
  | "accountant";

/**
 * Page de détails d'une entreprise
 * Affiche toutes les informations et permet l'édition par section
 */
export function CompanyDetails() {
  const formatPrice = (price: number) => price.toFixed(2).replace(".", ",");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, canInviteSuperadmin } = useAuth();

  // États
  const [company, setCompany] = useState<CompanyWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [activeTab, setActiveTab] = useState<CompanyTab>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // États gestion des membres
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [quota, setQuota] = useState<MembersQuota | null>(null);
  const [inviteSubscriptionSummary, setInviteSubscriptionSummary] =
    useState<InviteSubscriptionSummary | null>(null);
  const [inviteSubscriptionLoading, setInviteSubscriptionLoading] =
    useState(false);
  const [inviteSubscriptionError, setInviteSubscriptionError] = useState<
    string | null
  >(null);
  const [inviteConfirmationOpen, setInviteConfirmationOpen] = useState(false);
  const [inviteAddonAccepted, setInviteAddonAccepted] = useState(false);
  const [pendingInvite, setPendingInvite] =
    useState<InviteConfirmationPayload | null>(null);
  const [memberPaymentClientSecret, setMemberPaymentClientSecret] =
    useState<string | null>(null);
  const [memberPaymentInvitationId, setMemberPaymentInvitationId] =
    useState<string | null>(null);
  const finalizedMemberInvitationRef = useRef<string | null>(null);
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState<string | null>(null);

  // Comptable associé
  const [accountantSearchQuery, setAccountantSearchQuery] = useState("");
  const [accountantSearchResults, setAccountantSearchResults] = useState<any[]>(
    [],
  );
  const [accountantSearching, setAccountantSearching] = useState(false);
  const [unlinkAccountantOpen, setUnlinkAccountantOpen] = useState(false);
  const [accountantLinking, setAccountantLinking] = useState(false);
  const [isReplacingAccountant, setIsReplacingAccountant] = useState(false);
  const [firmInviteData, setFirmInviteData] = useState({
    firm_name: "",
    siren: "",
    email: "",
  });
  const [invitingFirm, setInvitingFirm] = useState(false);
  const [incomingAccountantRequests, setIncomingAccountantRequests] = useState<
    AccountantLinkRequest[]
  >([]);
  const [incomingRequestsLoading, setIncomingRequestsLoading] = useState(false);
  const [processingAccountantRequestId, setProcessingAccountantRequestId] =
    useState<string | null>(null);

  // Permissions (hook must be called unconditionally, before any early return)
  const permissions = usePermissions(company?.role, company?.company_owner_role);

  const isAdmin = permissions.canManageCompanySettings;
  const isCabinetCompany = company?.company_owner_role === "accountant";
  const canManageMembers = permissions.canManageUsers;
  const canInviteSuperadminOnly = Boolean(
    canInviteSuperadmin && company?.company_owner_role === "merchant_admin",
  );
  const canInviteMembers = canManageMembers || canInviteSuperadminOnly;
  const canViewMembers = Boolean(
    company &&
      (canInviteMembers ||
        (isCabinetCompany
          ? permissions.isAccountantSide
          : company.role === "accountant")),
  );
  const membersTabLabel = canManageMembers ? "Gestion des profils" : "Profils";

  const availableRoles: { value: string; label: string }[] = canManageMembers
    ? isCabinetCompany
      ? [
          { value: "accountant", label: "Expert-comptable" },
          { value: "accountant_consultant", label: "Collaborateur comptable" },
        ]
      : [
          { value: "merchant_admin", label: "Administrateur commerçant" },
          { value: "merchant_consultant", label: "Collaborateur commerçant" },
          ...(canInviteSuperadminOnly
            ? [{ value: "superadmin", label: "Superadmin" }]
            : []),
        ]
    : canInviteSuperadminOnly
      ? [{ value: "superadmin", label: "Superadmin" }]
      : [];

  const canDeleteMember = (
    _memberRole: string,
    memberUserId: string,
  ): boolean => {
    return Boolean(user?.id && canManageMembers && memberUserId !== user.id);
  };

  // États des formulaires pour chaque section
  const [generalForm, setGeneralForm] = useState<GeneralData>({
    name: "",
    legal_name: "",
    siren: "",
    vat_number: "",
    logo_url: "",
  });

  const [contactForm, setContactForm] = useState<ContactData>({
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    postal_code: "",
    country: "FR",
  });

  const [bankingForm, setBankingForm] = useState<BankingData>({
    rib_iban: "",
    rib_bic: "",
    rib_bank_name: "",
  });

  const [settingsForm, setSettingsForm] = useState<SettingsData>({
    default_vat_rate: 20,
    is_vat_exempt: false,
    vat_exemption_note: "TVA non applicable, art. 293 B du CGI",
    default_payment_terms: 30,
    quote_validity_days: 30,
    terms_and_conditions: "",
    quote_footer: "",
    invoice_footer: "",
  });

  // Chargement des données
  useEffect(() => {
    if (id) {
      loadCompany();
    }
  }, [id]);

  useEffect(() => {
    if (!id || company?.role !== "merchant_admin") {
      setIncomingAccountantRequests([]);
      setIncomingRequestsLoading(false);
      return;
    }

    void loadIncomingAccountantRequests(id);
  }, [id, company?.role]);

  // Synchroniser les formulaires quand company change
  useEffect(() => {
    if (company) {
      setGeneralForm({
        name: company.name || "",
        legal_name: company.legal_name || "",
        siren: company.siren || "",
        vat_number: company.vat_number || "",
        logo_url: company.logo_url || "",
      });
      setContactForm({
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address: company.address || "",
        city: company.city || "",
        postal_code: company.postal_code || "",
        country: company.country || "FR",
      });
      setBankingForm({
        rib_iban: company.rib_iban || "",
        rib_bic: company.rib_bic || "",
        rib_bank_name: company.rib_bank_name || "",
      });
      setSettingsForm({
        default_vat_rate: company.default_vat_rate ?? 20,
        is_vat_exempt: Boolean(company.is_vat_exempt),
        vat_exemption_note:
          company.vat_exemption_note || "TVA non applicable, art. 293 B du CGI",
        default_payment_terms: company.default_payment_terms ?? 30,
        quote_validity_days: company.quote_validity_days ?? 30,
        terms_and_conditions: company.terms_and_conditions || "",
        quote_footer: company.quote_footer || "",
        invoice_footer: company.invoice_footer || "",
      });
    }
  }, [company]);

  // Initialiser le rôle d'invitation par défaut
  useEffect(() => {
    if (availableRoles.length === 0) {
      setInviteRole("");
      return;
    }
    const isCurrentRoleAllowed = availableRoles.some(
      (role) => role.value === inviteRole,
    );
    if (!isCurrentRoleAllowed) {
      setInviteRole(availableRoles[0].value);
    }
  }, [availableRoles, inviteRole]);

  useEffect(() => {
    if (!id || !canManageMembers || isCabinetCompany) {
      setInviteSubscriptionSummary(null);
      setInviteSubscriptionError(null);
      setInviteSubscriptionLoading(false);
      return;
    }

    void loadInviteSubscriptionSummary();
  }, [id, canManageMembers, isCabinetCompany]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await companyService.getById(id!);
      setCompany(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de charger l'entreprise",
      });
      navigate("/companies");
    } finally {
      setLoading(false);
    }
  };

  const loadIncomingAccountantRequests = async (companyId: string) => {
    try {
      setIncomingRequestsLoading(true);
      const requests = await companyService.getAccountantLinkRequests(
        companyId,
        "incoming",
      );
      setIncomingAccountantRequests(requests);
    } catch (error) {
      console.error("Error loading accountant link requests:", error);
      setIncomingAccountantRequests([]);
    } finally {
      setIncomingRequestsLoading(false);
    }
  };

  const resetInviteConfirmation = () => {
    setInviteConfirmationOpen(false);
    setInviteAddonAccepted(false);
    setPendingInvite(null);
  };

  const loadInviteSubscriptionSummary = async () => {
    if (!id) return;

    try {
      setInviteSubscriptionLoading(true);
      setInviteSubscriptionError(null);

      const data = await subscriptionService.getSubscriptionWithPlans(id);
      const plan = data.subscription?.plan;

      if (!plan) {
        setInviteSubscriptionSummary(null);
        setInviteSubscriptionError(
          "Aucun abonnement exploitable n'est disponible pour cette entreprise. L'invitation est bloquée tant que le récapitulatif d'abonnement ne peut pas être affiché.",
        );
        return;
      }

      const activeMembers = data.usage?.total_members || 0;
      const pendingInvitations = data.usage?.pending_invitations || 0;
      const currentBillableMembers = data.usage?.billable_members || 0;
      const currentBillableExtraMembers =
        data.usage?.billable_extra_members || 0;
      const addonPriceMonthlyHt = plan.price_per_additional_member || 0;

      setInviteSubscriptionSummary({
        planName: plan.name,
        billingPeriod:
          data.subscription?.billing_period === "yearly" ? "yearly" : "monthly",
        activeMembers,
        pendingInvitations,
        currentBillableMembers,
        currentBillableExtraMembers,
        projectedBillableMembers: currentBillableMembers + 1,
        projectedBillableExtraMembers: currentBillableExtraMembers + 1,
        addonPriceMonthlyHt,
        canManageBilling: data.can_manage_billing,
        scope: data.scope,
      });
    } catch (error: any) {
      setInviteSubscriptionSummary(null);
      setInviteSubscriptionError(
        error.message ||
          "Impossible de charger le récapitulatif d'abonnement requis pour inviter un membre.",
      );
    } finally {
      setInviteSubscriptionLoading(false);
    }
  };

  const getValidatedInvitePayload = (): InviteConfirmationPayload | null => {
    if (!id || !inviteRole || !canInviteMembers) return null;

    const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedInviteEmail) {
      setEmailError("L'email est requis");
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInviteEmail)) {
      setEmailError("Format d'email invalide");
      return null;
    }

    setEmailError("");

    return {
      email: normalizedInviteEmail,
      role: inviteRole,
    };
  };

  // Enterprise lookup pour section Général
  const handleGeneralSirenSelect = (result: SirenSearchResult) => {
    setGeneralForm((prev) => ({
      ...prev,
      legal_name: result.company_name || prev.legal_name,
      siren: result.siren || prev.siren,
      vat_number: result.vat_number || prev.vat_number,
    }));
  };

  // Gestion des formulaires par section
  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGeneralForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGeneralLogoUploaded = (url: string) => {
    setGeneralForm((prev) => ({ ...prev, logo_url: url }));
  };

  const handleGeneralLogoRemoved = () => {
    setGeneralForm((prev) => ({ ...prev, logo_url: "" }));
  };

  const handleContactChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBankingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBankingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSettingsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setSettingsForm((prev) => ({
      ...prev,
      [name]: type === "number" ? (value ? parseFloat(value) : 0) : value,
    }));
  };

  // Sauvegarde d'une section spécifique
  const handleSaveSection = async (section: EditingSection) => {
    if (!id || !section) return;

    try {
      setIsSubmitting(true);
      let updatedCompany: CompanyWithRole;

      switch (section) {
        case "general":
          updatedCompany = await companyService.updateGeneral(id, generalForm);
          break;
        case "contact":
          updatedCompany = await companyService.updateContact(id, contactForm);
          break;
        case "banking":
          updatedCompany = await companyService.updateBanking(id, bankingForm);
          break;
        case "settings":
          updatedCompany = await companyService.updateSettings(
            id,
            settingsForm,
          );
          break;
        default:
          return;
      }

      setCompany(updatedCompany);
      setEditingSection(null);
      toast({
        title: "Succès",
        description: "Section mise à jour avec succès",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la section",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Annulation des modifications d'une section
  const handleCancelSection = () => {
    if (company) {
      // Réinitialiser le formulaire de la section en cours
      switch (editingSection) {
        case "general":
          setGeneralForm({
            name: company.name || "",
            legal_name: company.legal_name || "",
            siren: company.siren || "",
            vat_number: company.vat_number || "",
            logo_url: company.logo_url || "",
          });
          break;
        case "contact":
          setContactForm({
            email: company.email || "",
            phone: company.phone || "",
            website: company.website || "",
            address: company.address || "",
            city: company.city || "",
            postal_code: company.postal_code || "",
            country: company.country || "FR",
          });
          break;
        case "banking":
          setBankingForm({
            rib_iban: company.rib_iban || "",
            rib_bic: company.rib_bic || "",
            rib_bank_name: company.rib_bank_name || "",
          });
          break;
        case "settings":
          setSettingsForm({
            default_vat_rate: company.default_vat_rate ?? 20,
            is_vat_exempt: Boolean(company.is_vat_exempt),
            vat_exemption_note:
              company.vat_exemption_note ||
              "TVA non applicable, art. 293 B du CGI",
            default_payment_terms: company.default_payment_terms ?? 30,
            quote_validity_days: company.quote_validity_days ?? 30,
            terms_and_conditions: company.terms_and_conditions || "",
            quote_footer: company.quote_footer || "",
            invoice_footer: company.invoice_footer || "",
          });
          break;
      }
    }
    setEditingSection(null);
  };

  const handleTabChange = (nextTab: string) => {
    if (editingSection !== null) {
      handleCancelSection();
    }

    setActiveTab(nextTab as CompanyTab);

    if (nextTab === "members") {
      void loadMembers();
    }
  };

  // Définir comme entreprise par défaut
  const handleSetDefault = async () => {
    if (!id || !company) return;

    try {
      await companyService.setDefault(id);
      setCompany({ ...company, is_default: true });
      toast({
        title: "Succès",
        description: `${company.name} est maintenant votre entreprise par défaut`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error.message || "Impossible de définir l'entreprise par défaut",
      });
    }
  };

  // Suppression de l'entreprise
  const handleDelete = async () => {
    if (!id) return;

    try {
      setIsSubmitting(true);
      await companyService.delete(id);
      toast({
        title: "Succès",
        description: "Entreprise supprimée avec succès",
      });
      navigate("/companies");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'entreprise",
      });
    } finally {
      setIsSubmitting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const searchAccountant = async () => {
    if (!accountantSearchQuery.trim()) return;
    setAccountantSearching(true);
    try {
      const results = await companyService.searchAccountants(
        accountantSearchQuery,
      );
      setAccountantSearchResults(results);
      if (results.length === 0) {
        toast({
          title: "Aucun résultat",
          description: "Aucun cabinet comptable trouvé sur la plateforme",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la recherche",
      });
    } finally {
      setAccountantSearching(false);
    }
  };

  const handleLinkAccountant = async (accountantCompanyId: string) => {
    if (!id) return;
    setAccountantLinking(true);
    try {
      const updated = await companyService.linkAccountant(
        id,
        accountantCompanyId,
      );
      setCompany(updated);
      setAccountantSearchQuery("");
      setAccountantSearchResults([]);
      setIsReplacingAccountant(false);
      toast({
        title: "Comptable associé",
        description: "Le cabinet comptable a été associé à votre entreprise",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'associer le comptable",
      });
    } finally {
      setAccountantLinking(false);
    }
  };

  const handleUnlinkAccountant = async () => {
    if (!id) return;
    try {
      const updated = await companyService.unlinkAccountant(id);
      setCompany(updated);
      setIsReplacingAccountant(false);
      toast({
        title: "Comptable dissocié",
        description: "Le cabinet comptable a été dissocié de votre entreprise",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de dissocier le comptable",
      });
    }
  };

  const handleInviteAccountantFirm = async () => {
    if (!id) return;

    const payload = {
      firm_name: firmInviteData.firm_name.trim(),
      siren: firmInviteData.siren.replace(/\s/g, ""),
      email: firmInviteData.email.trim().toLowerCase(),
    };

    if (!payload.firm_name || !payload.siren || !payload.email) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Nom du cabinet, SIREN et email sont obligatoires.",
      });
      return;
    }

    if (!/^[0-9]{9}$/.test(payload.siren)) {
      toast({
        variant: "destructive",
        title: "SIREN invalide",
        description: "Le SIREN doit contenir exactement 9 chiffres.",
      });
      return;
    }

    setInvitingFirm(true);
    try {
      const result = await companyService.inviteAccountantFirm(id, payload);
      if (result.status === "existing_accountant") {
        await handleLinkAccountant(result.accountant_company.id);
        toast({
          title: "Cabinet déjà présent",
          description:
            "Ce cabinet existe déjà sur la plateforme et a été associé.",
        });
        return;
      }

      setFirmInviteData({
        firm_name: "",
        siren: "",
        email: "",
      });
      toast({
        title: "Invitation envoyée",
        description:
          "Le cabinet a reçu une invitation pour créer son compte et sera lié après inscription.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'inviter ce cabinet.",
      });
    } finally {
      setInvitingFirm(false);
    }
  };

  const handleRespondToAccountantRequest = async (
    requestId: string,
    decision: "accept" | "reject",
  ) => {
    if (!id) return;

    try {
      setProcessingAccountantRequestId(requestId);
      if (decision === "accept") {
        await companyService.acceptAccountantLinkRequest(id, requestId);
        toast({
          title: "Cabinet associé",
          description:
            "La demande a été acceptée et le cabinet comptable est maintenant lié à l’entreprise.",
        });
        await loadCompany();
      } else {
        await companyService.rejectAccountantLinkRequest(id, requestId);
        toast({
          title: "Demande refusée",
          description: "La demande de liaison a été refusée.",
        });
      }

      await loadIncomingAccountantRequests(id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error.message || "Impossible de traiter cette demande de liaison.",
      });
    } finally {
      setProcessingAccountantRequestId(null);
    }
  };

  // Gestion des membres
  const loadMembers = async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
      const data = await companyService.getMembers(id);
      setMembers(data.members);
      setInvitations(data.invitations);
      setQuota(data.quota);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les membres.",
        variant: "destructive",
      });
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!id || !canInviteMembers) return;

    const payload = getValidatedInvitePayload();
    if (!payload) return;

    if (isCabinetCompany || !canManageMembers) {
      setPendingInvite(payload);
      await confirmInvite(payload);
      return;
    }

    if (inviteSubscriptionLoading) {
      toast({
        title: "Abonnement en cours de chargement",
        description:
          "Le récapitulatif d'abonnement est encore en cours de chargement. Réessayez dans un instant.",
        variant: "destructive",
      });
      return;
    }

    if (!inviteSubscriptionSummary) {
      toast({
        title: "Récapitulatif d'abonnement indisponible",
        description:
          inviteSubscriptionError ||
          "Impossible d'afficher le détail d'abonnement requis pour cette invitation.",
        variant: "destructive",
      });
      return;
    }

    setPendingInvite(payload);
    setInviteAddonAccepted(false);
    setInviteConfirmationOpen(true);
  };

  const confirmInvite = async (payload = pendingInvite) => {
    if (!id || !payload || !canInviteMembers) return;

    setInviting(true);
    try {
      const result = await companyService.inviteMember(
        id,
        payload.email,
        payload.role,
      );
      if (result.status === "payment_required" && result.client_secret) {
        setMemberPaymentClientSecret(result.client_secret);
        setMemberPaymentInvitationId(result.id);
        setInviteConfirmationOpen(false);
        return;
      }
      setInviteEmail("");
      resetInviteConfirmation();
      await loadMembers();
      if (!isCabinetCompany && result.status === "accepted") {
        await loadInviteSubscriptionSummary();
      }
      toast({
        title:
          result.status === "accepted" ? "Membre ajouté" : "Invitation envoyée",
        description:
          result.status === "accepted"
            ? "L'utilisateur a été ajouté à l'entreprise."
            : "Un email d'invitation a été envoyé.",
      });
    } catch (error: any) {
      const is403 = error.message?.includes("Limite atteinte");
      toast({
        title: is403 ? "Limite de membres atteinte" : "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation.",
        variant: "destructive",
      });
      if (is403) await loadMembers(); // refresh quota
    } finally {
      setInviting(false);
    }
  };

  const handleMemberPaymentSuccess = async (
    invitationId = memberPaymentInvitationId,
    options?: { cleanUrl?: boolean },
  ) => {
    if (!id || !invitationId) return;

    try {
      const result = await companyService.finalizeInvitation(
        id,
        invitationId,
      );
      setMemberPaymentClientSecret(null);
      setMemberPaymentInvitationId(null);
      setInviteEmail("");
      resetInviteConfirmation();
      await loadMembers();
      await loadInviteSubscriptionSummary();
      toast({
        title:
          result.status === "accepted" ? "Membre ajouté" : "Invitation envoyée",
        description:
          result.status === "accepted"
            ? "L'utilisateur a été ajouté à l'entreprise."
            : "Un email d'invitation a été envoyé.",
      });
      if (options?.cleanUrl) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("member_invitation");
        nextParams.delete("payment_intent");
        nextParams.delete("payment_intent_client_secret");
        nextParams.delete("redirect_status");
        setSearchParams(nextParams, { replace: true });
      }
    } catch (error: any) {
      if (invitationId) {
        finalizedMemberInvitationRef.current = null;
      }
      toast({
        title: "Erreur",
        description:
          error.message || "Impossible de finaliser l'invitation.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const invitationId = searchParams.get("member_invitation");
    const hasStripeReturnParams =
      Boolean(searchParams.get("payment_intent")) ||
      Boolean(searchParams.get("payment_intent_client_secret")) ||
      Boolean(searchParams.get("redirect_status"));

    if (!id || !invitationId || !hasStripeReturnParams) {
      return;
    }

    const finalizeKey = `${id}:${invitationId}`;
    if (finalizedMemberInvitationRef.current === finalizeKey) {
      return;
    }
    finalizedMemberInvitationRef.current = finalizeKey;
    setActiveTab("members");

    void handleMemberPaymentSuccess(invitationId, { cleanUrl: true });
  }, [id, searchParams]);

  const handleUpdateMemberRole = async (
    memberUserId: string,
    nextRole: CompanyRole,
  ) => {
    if (!id || !canManageMembers) return;

    try {
      setUpdatingMemberRoleId(memberUserId);
      await companyService.updateMemberRole(id, memberUserId, nextRole);
      await loadMembers();
      toast({
        title: "Rôle mis à jour",
        description: "Le rôle du membre a été modifié.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier ce rôle.",
        variant: "destructive",
      });
    } finally {
      setUpdatingMemberRoleId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id || !canManageMembers) return;
    try {
      await companyService.removeMember(id, userId);
      await loadMembers();
      if (!isCabinetCompany) {
        await loadInviteSubscriptionSummary();
      }
      toast({
        title: "Membre retiré",
        description: "Le membre a été retiré de l'entreprise.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de retirer le membre.",
        variant: "destructive",
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!id || !canManageMembers) return;
    try {
      await companyService.cancelInvitation(id, invitationId);
      await loadMembers();
      toast({
        title: "Invitation annulée",
        description: "L'invitation a été annulée.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'annuler l'invitation.",
        variant: "destructive",
      });
    }
  };

  // Boutons d'édition/sauvegarde pour une section
  const SectionEditButtons = ({ section }: { section: EditingSection }) => {
    const isEditing = editingSection === section;
    const isAdmin = permissions.canManageCompanySettings;

    if (!isAdmin) return null;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelSection}
            disabled={isSubmitting}
          >
            <X className="mr-1 h-4 w-4" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={() => handleSaveSection(section)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditingSection(section)}
        disabled={editingSection !== null}
      >
        <Edit className="mr-1 h-4 w-4" />
        Modifier
      </Button>
    );
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Entreprise non trouvée
  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-2 text-lg font-medium">Entreprise non trouvée</h3>
        <p className="mb-4 text-muted-foreground">
          L'entreprise demandée n'existe pas ou vous n'y avez pas accès.
        </p>
        <Button onClick={() => navigate("/companies")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux entreprises
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/companies")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{company.name}</h1>
                {company.is_default && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3" />
                    Par défaut
                  </Badge>
                )}
                {company.is_owner && (
                  <Badge className="gap-1 text-white">
                    <Crown className="h-3 w-3" />
                    Propriétaire
                  </Badge>
                )}
              </div>
              {company.legal_name && (
                <p className="text-muted-foreground">{company.legal_name}</p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant={isAdmin ? "default" : "secondary"}
                  className={isAdmin ? "text-white" : undefined}
                >
                  {getRoleLabel(company.role)}
                </Badge>
                {company.siren && (
                  <span className="text-sm text-muted-foreground">
                    SIREN: {company.siren}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!company.is_default && (
            <Button variant="outline" onClick={handleSetDefault}>
              <Star className="mr-2 h-4 w-4" />
              Définir par défaut
            </Button>
          )}
          {isAdmin && editingSection === null && (
            <>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </>
          )}
          {editingSection !== null && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelSection}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
              <Button
                onClick={() => handleSaveSection(editingSection)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contenu principal avec onglets */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="flex w-full">
          <TabsTrigger value="general" className="flex-1 gap-2">
            <Building className="h-4 w-4" />
            Général
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex-1 gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="banking" className="flex-1 gap-2">
            <CreditCard className="h-4 w-4" />
            Bancaire
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </TabsTrigger>
          {canViewMembers && (
            <TabsTrigger value="members" className="flex-1 gap-2">
              <Users className="h-4 w-4" />
              {membersTabLabel}
            </TabsTrigger>
          )}
          {/* Onglet Chorus Pro temporairement masqué dans Mes entreprises. */}
          {/*
          {isAdmin && (
            <TabsTrigger value="chorus-pro" className="flex-1 gap-2">
              <Globe className="h-4 w-4" />
              Chorus Pro
            </TabsTrigger>
          )}
          */}
          {company?.role === "merchant_admin" && (
            <TabsTrigger value="accountant" className="flex-1 gap-2">
              <Calculator className="h-4 w-4" />
              Comptable
            </TabsTrigger>
          )}
        </TabsList>

        {/* Onglet Général */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Informations générales</CardTitle>
                <CardDescription>
                  Les informations principales de votre entreprise
                </CardDescription>
              </div>
              <SectionEditButtons section="general" />
            </CardHeader>
            <CardContent className="space-y-6">
              {editingSection === "general" && (
                <EnterpriseLookupField
                  mode="authenticated"
                  onSelect={handleGeneralSirenSelect}
                  onClear={() => {}}
                  compact
                />
              )}
              <div className="space-y-3">
                <Label>Logo</Label>
                {editingSection === "general" ? (
                  <div className="space-y-4">
                    {generalForm.logo_url ? (
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={generalForm.logo_url}
                            alt={`Logo ${generalForm.name || company.name}`}
                            className="h-16 w-16 rounded-lg border object-contain p-2"
                          />
                          <div>
                            <p className="font-medium">Logo actif</p>
                            <p className="text-sm text-muted-foreground">
                              Ce logo sera utilisé dans les devis, factures, PDF
                              et emails.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGeneralLogoRemoved}
                        >
                          Retirer le logo
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Aucun logo configuré pour cette entreprise.
                      </div>
                    )}
                    <ImageUpload
                      onUploadComplete={(response) =>
                        handleGeneralLogoUploaded(response.url)
                      }
                      recommendedMinWidth={512}
                      recommendedMinHeight={512}
                      maxWidth={2048}
                      maxHeight={2048}
                      helperText="SVG, PNG, JPG, WebP ou AVIF • Max 2 Mo • Conseillé: carré 512 x 512 à 1024 x 1024 px • Raster max 2048 x 2048 px"
                    />
                  </div>
                ) : company.logo_url ? (
                  <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted/20 p-3">
                        <img
                          src={company.logo_url}
                          alt={`Logo ${company.name}`}
                          className="h-full w-full rounded-lg object-contain"
                        />
                      </div>
                      <div>
                        <p className="font-medium">Logo configuré</p>
                        <p className="text-sm text-muted-foreground">
                          Utilisé sur les devis, factures, PDF et emails.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingSection("general")}
                      disabled={editingSection !== null}
                    >
                      Modifier le logo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted/20">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Aucun logo configuré</p>
                        <p className="text-sm text-muted-foreground">
                          Ajoutez un logo pour l’utiliser sur les devis, factures, PDF et emails.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingSection("general")}
                      disabled={editingSection !== null}
                    >
                      Ajouter un logo
                    </Button>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'entreprise</Label>
                  {editingSection === "general" ? (
                    <Input
                      id="name"
                      name="name"
                      value={generalForm.name || ""}
                      onChange={handleGeneralChange}
                    />
                  ) : (
                    <p className="text-sm">{company.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Raison sociale</Label>
                  {editingSection === "general" ? (
                    <Input
                      id="legal_name"
                      name="legal_name"
                      value={generalForm.legal_name || ""}
                      onChange={handleGeneralChange}
                    />
                  ) : (
                    <p className="text-sm">{company.legal_name || "—"}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="siren">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      SIREN
                    </div>
                  </Label>
                  {editingSection === "general" ? (
                    <Input
                      id="siren"
                      name="siren"
                      value={generalForm.siren || ""}
                      onChange={handleGeneralChange}
                      maxLength={9}
                    />
                  ) : (
                    <p className="text-sm font-mono">{company.siren || "—"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
                  {editingSection === "general" ? (
                    <Input
                      id="vat_number"
                      name="vat_number"
                      value={generalForm.vat_number || ""}
                      onChange={handleGeneralChange}
                    />
                  ) : (
                    <p className="text-sm font-mono">
                      {company.vat_number || "—"}
                    </p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Créée le{" "}
                  {new Date(company.created_at).toLocaleDateString("fr-FR")}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Modifiée le{" "}
                  {new Date(company.updated_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Contact */}
        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Coordonnées</CardTitle>
                <CardDescription>
                  Les informations de contact de votre entreprise
                </CardDescription>
              </div>
              <SectionEditButtons section="contact" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </Label>
                  {editingSection === "contact" ? (
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={contactForm.email || ""}
                      onChange={handleContactChange}
                    />
                  ) : (
                    <p className="text-sm">
                      {company.email ? (
                        <a
                          href={`mailto:${company.email}`}
                          className="text-primary hover:underline"
                        >
                          {company.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Téléphone
                    </div>
                  </Label>
                  {editingSection === "contact" ? (
                    <Input
                      id="phone"
                      name="phone"
                      value={contactForm.phone || ""}
                      onChange={handleContactChange}
                    />
                  ) : (
                    <p className="text-sm">
                      {company.phone ? (
                        <a
                          href={`tel:${company.phone}`}
                          className="text-primary hover:underline"
                        >
                          {company.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Site web
                  </div>
                </Label>
                {editingSection === "contact" ? (
                  <Input
                    id="website"
                    name="website"
                    value={contactForm.website || ""}
                    onChange={handleContactChange}
                  />
                ) : (
                  <p className="text-sm">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {company.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="address">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Adresse
                  </div>
                </Label>
                {editingSection === "contact" ? (
                  <Textarea
                    id="address"
                    name="address"
                    value={contactForm.address || ""}
                    onChange={handleContactChange}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm">{company.address || "—"}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  {editingSection === "contact" ? (
                    <Input
                      id="postal_code"
                      name="postal_code"
                      value={contactForm.postal_code || ""}
                      onChange={handleContactChange}
                    />
                  ) : (
                    <p className="text-sm">{company.postal_code || "—"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  {editingSection === "contact" ? (
                    <Input
                      id="city"
                      name="city"
                      value={contactForm.city || ""}
                      onChange={handleContactChange}
                    />
                  ) : (
                    <p className="text-sm">{company.city || "—"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  {editingSection === "contact" ? (
                    <Input
                      id="country"
                      name="country"
                      value={contactForm.country || "FR"}
                      onChange={handleContactChange}
                      maxLength={2}
                    />
                  ) : (
                    <p className="text-sm">{company.country || "FR"}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Bancaire */}
        <TabsContent value="banking" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Informations bancaires</CardTitle>
                <CardDescription>
                  Les coordonnées bancaires pour les paiements
                </CardDescription>
              </div>
              <SectionEditButtons section="banking" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="rib_iban">IBAN</Label>
                {editingSection === "banking" ? (
                  <Input
                    id="rib_iban"
                    name="rib_iban"
                    value={bankingForm.rib_iban || ""}
                    onChange={handleBankingChange}
                    placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                  />
                ) : (
                  <p className="text-sm font-mono">{company.rib_iban || "—"}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="rib_bic">BIC</Label>
                  {editingSection === "banking" ? (
                    <Input
                      id="rib_bic"
                      name="rib_bic"
                      value={bankingForm.rib_bic || ""}
                      onChange={handleBankingChange}
                    />
                  ) : (
                    <p className="text-sm font-mono">
                      {company.rib_bic || "—"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rib_bank_name">Nom de la banque</Label>
                  {editingSection === "banking" ? (
                    <Input
                      id="rib_bank_name"
                      name="rib_bank_name"
                      value={bankingForm.rib_bank_name || ""}
                      onChange={handleBankingChange}
                    />
                  ) : (
                    <p className="text-sm">{company.rib_bank_name || "—"}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Paramètres */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Paramètres par défaut</CardTitle>
                <CardDescription>
                  Configuration des valeurs par défaut pour les devis et
                  factures
                </CardDescription>
              </div>
              <SectionEditButtons section="settings" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default_vat_rate">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Taux TVA par défaut
                    </div>
                  </Label>
                  {editingSection === "settings" ? (
                    <NumericInput
                      id="default_vat_rate"
                      name="default_vat_rate"
                      value={settingsForm.default_vat_rate ?? 20}
                      onValueChange={(value) => {
                        setSettingsForm((prev) => ({
                          ...prev,
                          default_vat_rate: value,
                        }));
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                    />
                  ) : (
                    <p className="text-sm">{company.default_vat_rate}%</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="is_vat_exempt">
                    Franchise en base de TVA
                  </Label>
                  {editingSection === "settings" ? (
                    <label className="flex h-10 items-center gap-3 rounded-md border px-3 text-sm">
                      <input
                        id="is_vat_exempt"
                        type="checkbox"
                        checked={settingsForm.is_vat_exempt}
                        onChange={(event) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            is_vat_exempt: event.target.checked,
                            default_vat_rate: event.target.checked
                              ? 0
                              : prev.default_vat_rate,
                          }))
                        }
                      />
                      <span>Non assujettie à la TVA</span>
                    </label>
                  ) : (
                    <p className="text-sm">
                      {company.is_vat_exempt ? "Oui" : "Non"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_payment_terms">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Délai de paiement
                    </div>
                  </Label>
                  {editingSection === "settings" ? (
                    <NumericInput
                      id="default_payment_terms"
                      name="default_payment_terms"
                      value={settingsForm.default_payment_terms || 30}
                      onValueChange={(value) => {
                        setSettingsForm((prev) => ({
                          ...prev,
                          default_payment_terms: value,
                        }));
                      }}
                      min={0}
                      max={365}
                    />
                  ) : (
                    <p className="text-sm">
                      {company.default_payment_terms} jours
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote_validity_days">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Validité des devis
                    </div>
                  </Label>
                  {editingSection === "settings" ? (
                    <NumericInput
                      id="quote_validity_days"
                      name="quote_validity_days"
                      value={settingsForm.quote_validity_days || 30}
                      onValueChange={(value) => {
                        setSettingsForm((prev) => ({
                          ...prev,
                          quote_validity_days: value,
                        }));
                      }}
                      min={1}
                      max={365}
                    />
                  ) : (
                    <p className="text-sm">
                      {company.quote_validity_days} jours
                    </p>
                  )}
                </div>
              </div>
              {(editingSection === "settings" || company.is_vat_exempt) && (
                <div className="space-y-2">
                  <Label htmlFor="vat_exemption_note">Mention TVA</Label>
                  {editingSection === "settings" ? (
                    <Input
                      id="vat_exemption_note"
                      name="vat_exemption_note"
                      value={settingsForm.vat_exemption_note}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          vat_exemption_note: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm">
                      {company.vat_exemption_note ||
                        "TVA non applicable, art. 293 B du CGI"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Mentions légales
                </div>
              </CardTitle>
              <CardDescription>
                Textes affichés sur vos documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Conditions générales</Label>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/settings/legal-documents">
                      Gérer les CGV
                    </Link>
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  CGV par défaut utilisées pour les nouveaux devis.
                  {" "}
                  <Link to="/settings/legal-documents" className="font-medium text-foreground underline">
                    Modifier la CGV par défaut
                  </Link>
                  .
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {company.terms_and_conditions || "Aucune CGV par défaut pour le moment."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="quote_footer">Pied de page des devis</Label>
                  <p className="text-xs text-muted-foreground">
                    Texte libre distinct des CGV, prévu pour vos mentions de bas de page sur les devis.
                  </p>
                  {editingSection === "settings" ? (
                    <Textarea
                      id="quote_footer"
                      name="quote_footer"
                      value={settingsForm.quote_footer || ""}
                      onChange={handleSettingsChange}
                      rows={3}
                      placeholder="Texte en bas de vos devis..."
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {company.quote_footer || "—"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_footer">
                    Pied de page des factures
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Texte libre utilisé comme base dans la création des factures, séparé des CGV.
                  </p>
                  {editingSection === "settings" ? (
                    <Textarea
                      id="invoice_footer"
                      name="invoice_footer"
                      value={settingsForm.invoice_footer || ""}
                      onChange={handleSettingsChange}
                      rows={3}
                      placeholder="Texte en bas de vos factures..."
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {company.invoice_footer || "—"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Profils */}
        {canViewMembers && (
          <TabsContent value="members" className="space-y-6">
            {!canManageMembers && !canInviteSuperadminOnly && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Profils de l'entreprise
                  </CardTitle>
                  <CardDescription>
                    Consultation uniquement.{" "}
                    {isCabinetCompany
                      ? "Seul l'expert-comptable administrateur peut inviter, supprimer ou annuler une invitation."
                      : "Seuls les administrateurs marchands peuvent inviter, supprimer ou annuler une invitation."}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {!canManageMembers && canInviteSuperadminOnly && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Compte racine superadmin
                  </CardTitle>
                  <CardDescription>
                    Ce compte peut inviter uniquement d&apos;autres superadmins.
                    Il ne peut pas gérer les autres profils de l&apos;entreprise.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Carte de limites (entreprises marchandes uniquement) */}
            {canManageMembers &&
              quota &&
              !isCabinetCompany &&
              (() => {
                const used = quota.current_members + quota.pending_invitations;
                const max = quota.max_members;
                const isLimited = max !== null;
                const percentage = isLimited
                  ? Math.min((used / max) * 100, 100)
                  : 0;
                const limitReached = isLimited && used >= max;
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Limites du plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Membres (actifs + invitations)</span>
                        <span className="font-medium">
                          {used} / {max ?? "∞"}
                        </span>
                      </div>
                      {isLimited && (
                        <Progress value={percentage} className="h-2" />
                      )}
                      {limitReached && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-md p-3">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>
                            Limite de membres atteinte. Passez à un plan
                            supérieur pour inviter plus de collaborateurs.
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

            {/* Formulaire d'invitation */}
            {canInviteMembers && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    {canManageMembers
                      ? "Inviter un collaborateur"
                      : "Inviter un superadmin"}
                  </CardTitle>
                  <CardDescription>
                    {canManageMembers
                      ? "Invitez un membre par email. Il recevra un email pour rejoindre l'entreprise."
                      : "Invitez un superadmin par email. Les autres rôles restent verrouillés pour ce compte."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {canManageMembers && isCabinetCompany ? (
                      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                        Les membres du cabinet sont illimités et n'entraînent
                        aucun surcoût.
                      </div>
                    ) : canManageMembers ? (
                      <div className="rounded-lg border bg-muted/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              Récapitulatif abonnement
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Le membre supplémentaire est facturé dès l'envoi
                              de l'invitation.
                            </p>
                          </div>
                          {inviteSubscriptionSummary && (
                            <Badge variant="secondary">
                              {inviteSubscriptionSummary.planName} ·{" "}
                              {inviteSubscriptionSummary.billingPeriod ===
                              "yearly"
                                ? "Annuel"
                                : "Mensuel"}
                            </Badge>
                          )}
                        </div>

                        {inviteSubscriptionLoading ? (
                          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement du détail d'abonnement...
                          </div>
                        ) : inviteSubscriptionError ? (
                          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            {inviteSubscriptionError}
                          </div>
                        ) : inviteSubscriptionSummary ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-md border bg-background p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Membres actifs
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                {inviteSubscriptionSummary.activeMembers}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {inviteSubscriptionSummary.pendingInvitations}{" "}
                                invitation
                                {inviteSubscriptionSummary.pendingInvitations > 1
                                  ? "s"
                                  : ""}{" "}
                                en attente, {inviteSubscriptionSummary.currentBillableExtraMembers} membre
                                {inviteSubscriptionSummary.currentBillableExtraMembers > 1
                                  ? "s"
                                  : ""}
                                {" "}supplémentaire
                                {inviteSubscriptionSummary.currentBillableExtraMembers > 1
                                  ? "s"
                                  : ""} facturé
                              </p>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Membre supplémentaire
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                {formatPrice(
                                  inviteSubscriptionSummary.addonPriceMonthlyHt,
                                )}{" "}
                                € HT/mois
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Facturé à l'envoi
                              </p>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Impact projeté
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                +1 place facturable
                              </p>
                              <p className="text-xs text-muted-foreground">
                                +{formatPrice(
                                  inviteSubscriptionSummary.addonPriceMonthlyHt,
                                )}{" "}
                                € HT/mois
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {inviteSubscriptionSummary &&
                          !inviteSubscriptionSummary.canManageBilling && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {inviteSubscriptionSummary.scope === "owner"
                                ? "La facturation reste portée par le propriétaire de l'entreprise."
                                : "Vous n'avez pas la gestion directe de la facturation, mais le surcoût doit être confirmé avant envoi."}
                            </p>
                          )}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                        Seule l&apos;invitation du rôle{" "}
                        <strong>Superadmin</strong> est autorisée pour ce compte
                        racine.
                      </div>
                    )}

                    <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="invite-email" className="sr-only">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="collaborateur@email.com"
                          value={inviteEmail}
                          onChange={(e) => {
                            setInviteEmail(e.target.value);
                            if (emailError) setEmailError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleInvite();
                            }
                          }}
                          className={`pl-9 ${emailError ? "border-destructive" : ""}`}
                        />
                      </div>
                      {emailError && (
                        <p className="text-xs text-destructive">
                          {emailError}
                        </p>
                      )}
                    </div>
                    {availableRoles.length > 1 && (
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      onClick={handleInvite}
                      disabled={
                        inviting ||
                        (canManageMembers &&
                          !isCabinetCompany &&
                          (inviteSubscriptionLoading ||
                            !inviteSubscriptionSummary)) ||
                        (quota?.max_members != null &&
                          quota.current_members + quota.pending_invitations >=
                            quota.max_members)
                      }
                    >
                      {inviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Inviter
                        </>
                      )}
                    </Button>
                  </div>
                  </div>
                  {availableRoles.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Le collaborateur sera invité avec le rôle :{" "}
                      {getRoleLabel(
                        (inviteRole || availableRoles[0]?.value) as CompanyRole,
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Liste des membres */}
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Membres actifs ({members.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {members.map((member, index) => (
                      <div key={member.id}>
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={member.avatar_url || undefined}
                              />
                              <AvatarFallback>
                                {(
                                  member.first_name?.[0] ||
                                  member.email?.[0] ||
                                  "U"
                                ).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {[member.first_name, member.last_name]
                                  .filter(Boolean)
                                  .join(" ") || member.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {canManageMembers && availableRoles.length > 1 ? (
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  void handleUpdateMemberRole(
                                    member.user_id,
                                    value as CompanyRole,
                                  )
                                }
                                disabled={updatingMemberRoleId === member.user_id}
                              >
                                <SelectTrigger className="h-8 w-[220px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableRoles
                                    .filter((roleOption) => roleOption.value !== "superadmin")
                                    .map((roleOption) => (
                                      <SelectItem
                                        key={roleOption.value}
                                        value={roleOption.value}
                                      >
                                        {roleOption.label}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant={
                                  member.role === "merchant_admin" ||
                                  member.role === "accountant"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  member.role === "merchant_admin" ||
                                  member.role === "accountant"
                                    ? "text-white"
                                    : undefined
                                }
                              >
                                <Shield className="mr-1 h-3 w-3" />
                                {getRoleLabel(member.role as CompanyRole)}
                              </Badge>
                            )}
                            {canDeleteMember(member.role, member.user_id) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Retirer ce membre ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.first_name || member.email} n'aura
                                      plus accès à cette entreprise. Cette
                                      action peut être annulée en renvoyant une
                                      invitation.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Annuler
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleRemoveMember(member.user_id)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Retirer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun membre pour le moment.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {invitations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Invitations en attente ({invitations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {invitations.map((invitation, index) => (
                        <div key={invitation.id}>
                          {index > 0 && <Separator className="my-3" />}
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>
                                  {invitation.email[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {invitation.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expire le{" "}
                                  {new Date(
                                    invitation.expires_at,
                                  ).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">
                                {getRoleLabel(invitation.role as CompanyRole)}
                              </Badge>
                              {canManageMembers && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Annuler cette invitation ?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        L'invitation envoyée à {invitation.email}{" "}
                                        sera annulée.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Garder
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleCancelInvitation(invitation.id)
                                        }
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Annuler l'invitation
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        )}

        {/* Onglet Chorus Pro temporairement masqué dans Mes entreprises. */}

        {/* Onglet Comptable associé */}
        {company?.role === "merchant_admin" && (
          <TabsContent value="accountant" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Comptable associé
                </CardTitle>
                <CardDescription>
                  Associez un cabinet comptable à votre entreprise pour
                  faciliter la collaboration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {incomingRequestsLoading && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Chargement des demandes de liaison comptable...
                      </div>
                    )}

                    {incomingAccountantRequests.length > 0 &&
                      company.accountant_link_status !== "linked" && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <p className="font-medium text-blue-900">
                              Demandes de liaison en attente
                            </p>
                            <p className="mt-1 text-sm text-blue-800">
                              Un ou plusieurs cabinets souhaitent être associés
                              à votre entreprise. Vous pouvez accepter ou
                              refuser chaque demande.
                            </p>
                          </div>
                          {incomingAccountantRequests.map((request) => (
                            <div
                              key={request.id}
                              className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {request.accountant_company.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {[
                                    request.accountant_company.siren
                                      ? `SIREN : ${request.accountant_company.siren}`
                                      : null,
                                    request.accountant_company.city,
                                    request.accountant_company.email,
                                  ]
                                    .filter(Boolean)
                                    .join(" • ") || "Informations partielles"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Demande envoyée le{" "}
                                  {new Date(
                                    request.created_at,
                                  ).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    handleRespondToAccountantRequest(
                                      request.id,
                                      "reject",
                                    )
                                  }
                                  disabled={
                                    processingAccountantRequestId === request.id
                                  }
                                >
                                  Refuser
                                </Button>
                                <Button
                                  onClick={() =>
                                    handleRespondToAccountantRequest(
                                      request.id,
                                      "accept",
                                    )
                                  }
                                  disabled={
                                    processingAccountantRequestId === request.id
                                  }
                                >
                                  {processingAccountantRequestId ===
                                  request.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                  )}
                                  Accepter
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    {company.accountant_link_status === 'linked' && company.accountant_firm_summary ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Calculator className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {company.accountant_firm_summary.name}
                              </p>
                              {company.accountant_firm_summary.siren && (
                                <p className="text-sm text-muted-foreground">
                                  SIREN : {company.accountant_firm_summary.siren}
                                </p>
                              )}
                              {company.accountant_firm_summary.email && (
                                <p className="text-sm text-muted-foreground">
                                  {company.accountant_firm_summary.email}
                                </p>
                              )}
                              {(company.accountant_firm_summary.phone || company.accountant_firm_summary.city) && (
                                <p className="text-sm text-muted-foreground">
                                  {[company.accountant_firm_summary.phone, company.accountant_firm_summary.city].filter(Boolean).join(' — ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUnlinkAccountantOpen(true)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Unlink className="mr-2 h-4 w-4" />
                            Dissocier
                          </Button>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            variant={
                              isReplacingAccountant ? "secondary" : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              setIsReplacingAccountant((prev) => !prev)
                            }
                          >
                            {isReplacingAccountant
                              ? "Annuler le remplacement"
                              : "Remplacer le cabinet"}
                          </Button>
                        </div>
                      </div>
                    ) : company.accountant_link_status === 'invite_pending' ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <p className="text-sm text-yellow-700">
                              Invitation en attente de réponse du cabinet comptable.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <Calculator className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Aucun comptable associé à cette entreprise.
                        </p>
                      </div>
                    )}

                    {(company.accountant_link_status !== 'linked' ||
                      isReplacingAccountant) && (
                      <>
                        <div className="space-y-2">
                          <Label>
                            Rechercher un cabinet existant (nom ou SIREN)
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nom du cabinet ou SIREN..."
                              value={accountantSearchQuery}
                              onChange={(e) =>
                                setAccountantSearchQuery(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  searchAccountant();
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              onClick={searchAccountant}
                              disabled={
                                accountantSearching ||
                                !accountantSearchQuery.trim()
                              }
                            >
                              {accountantSearching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {accountantSearchResults.length > 0 && (
                            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                              {accountantSearchResults.map((result: any) => (
                                <div
                                  key={result.id}
                                  className="flex items-center justify-between p-3 hover:bg-muted transition-colors"
                                >
                                  <div>
                                    <p className="font-medium">{result.name}</p>
                                    {result.siren && (
                                      <p className="text-sm text-muted-foreground">
                                        SIREN : {result.siren}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleLinkAccountant(result.id)
                                    }
                                    disabled={accountantLinking}
                                  >
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Associer
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <Label>Inviter un cabinet non inscrit</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              placeholder="Nom du cabinet"
                              value={firmInviteData.firm_name}
                              onChange={(e) =>
                                setFirmInviteData((prev) => ({
                                  ...prev,
                                  firm_name: e.target.value,
                                }))
                              }
                            />
                            <Input
                              placeholder="SIREN"
                              value={firmInviteData.siren}
                              onChange={(e) =>
                                setFirmInviteData((prev) => ({
                                  ...prev,
                                  siren: e.target.value,
                                }))
                              }
                            />
                            <Input
                              placeholder="Email du cabinet"
                              value={firmInviteData.email}
                              onChange={(e) =>
                                setFirmInviteData((prev) => ({
                                  ...prev,
                                  email: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={handleInviteAccountantFirm}
                              disabled={invitingFirm}
                            >
                              {invitingFirm && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Envoyer l'invitation cabinet
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Si le cabinet existe déjà, il sera proposé pour
                            association immédiate.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Confirmation dissociation comptable */}
      <ConfirmationDialog
        open={unlinkAccountantOpen}
        onConfirm={() => {
          setUnlinkAccountantOpen(false);
          handleUnlinkAccountant();
        }}
        onCancel={() => setUnlinkAccountantOpen(false)}
        title="Dissocier le comptable ?"
        description="Le cabinet comptable sera dissocié de votre entreprise. Vous pourrez en associer un autre par la suite."
        confirmLabel="Dissocier"
        variant="destructive"
      />

      {!isCabinetCompany && (
        <Dialog
          open={inviteConfirmationOpen}
          onOpenChange={(open) => {
            if (inviting) return;
            if (!open) {
              resetInviteConfirmation();
              return;
            }
            setInviteConfirmationOpen(true);
          }}
        >
          <DialogContent overlayClassName="bg-black/40">
            <DialogHeader>
              <DialogTitle>Confirmer l'ajout d'un membre supplémentaire</DialogTitle>
              <DialogDescription>
                Vérifiez l'impact de cette invitation avant l'envoi à{" "}
                <strong>{pendingInvite?.email || "ce collaborateur"}</strong>.
              </DialogDescription>
            </DialogHeader>

            {inviteSubscriptionSummary && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {inviteSubscriptionSummary.planName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Facturation{" "}
                        {inviteSubscriptionSummary.billingPeriod === "yearly"
                          ? "annuelle"
                          : "mensuelle"}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      +{formatPrice(inviteSubscriptionSummary.addonPriceMonthlyHt)}{" "}
                      € HT/mois
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Situation actuelle
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {inviteSubscriptionSummary.activeMembers} membre
                        {inviteSubscriptionSummary.activeMembers > 1 ? "s" : ""} actif
                        {inviteSubscriptionSummary.activeMembers > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inviteSubscriptionSummary.pendingInvitations} invitation
                        {inviteSubscriptionSummary.pendingInvitations > 1
                          ? "s"
                          : ""} en attente, {inviteSubscriptionSummary.currentBillableExtraMembers} add-on
                        {inviteSubscriptionSummary.currentBillableExtraMembers > 1
                          ? "s"
                          : ""} facturé
                      </p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Après envoi
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {inviteSubscriptionSummary.projectedBillableMembers} places facturables
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inviteSubscriptionSummary.projectedBillableExtraMembers} add-ons
                        {" "}facturables au total
                      </p>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={inviteAddonAccepted}
                    onChange={(event) =>
                      setInviteAddonAccepted(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span>
                    J'accepte l'ajout de ce membre supplémentaire de{" "}
                    {formatPrice(inviteSubscriptionSummary.addonPriceMonthlyHt)} €
                    HT/mois à l'abonnement dès l'envoi de l'invitation.
                  </span>
                </label>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={inviting}
                onClick={resetInviteConfirmation}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => confirmInvite()}
                disabled={!inviteAddonAccepted || inviting}
              >
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={Boolean(memberPaymentClientSecret)}
        onOpenChange={(open) => {
          if (!open) {
            setMemberPaymentClientSecret(null);
            setMemberPaymentInvitationId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
            <DialogDescription>
              L'invitation sera envoyée après validation du paiement.
            </DialogDescription>
          </DialogHeader>
          {memberPaymentClientSecret && (
            <PaymentForm
              clientSecret={memberPaymentClientSecret}
              onSuccess={() => {
                void handleMemberPaymentSuccess();
              }}
              returnUrl={`${window.location.origin}/companies/${id}?member_invitation=${memberPaymentInvitationId ?? ""}`}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{company.name}</strong>{" "}
              ? Cette action est irréversible. Toutes les données associées
              seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
