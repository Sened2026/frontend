import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Stepper } from "@/components/ui/stepper";
import {
    authService,
    subscriptionService,
    inviteService,
    type SubscriptionPlan,
    type InviteValidationResponse,
    type RegistrationPricing,
} from "@/services/api";
import { EnterpriseLookupField } from "@/components/shared/EnterpriseLookupField";
import {
    PaymentForm,
    type PaymentFormBillingDetails,
} from "@/components/PaymentForm";
import {
    Check,
    Eye,
    EyeOff,
    Lock,
    Mail,
    User,
    Building2,
    MapPin,
    Phone,
    FileText,
    CreditCard,
    Loader2,
    AlertCircle,
    Briefcase,
    Users,
    Calculator,
    ArrowLeft,
    Shield,
    TicketPercent,
    X,
} from "lucide-react";
import type { CompanyRole, SirenSearchResult } from "@/types";

interface FormData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    company_name: string;
    siren: string;
    address: string;
    postal_code: string;
    city: string;
    team_size: string;
    accountant_siren: string;
}

type CompanyCreationMode = "create" | "join_only";

const COMPANY_OWNER_ROLES: CompanyRole[] = ["merchant_admin", "accountant"];
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const REGISTRATION_SUPPORT_EMAIL = "contact@sened.fr";

const roleOptions: Array<{
    role: CompanyRole;
    title: string;
    description: string;
    icon: typeof Building2;
}> = [
    {
        role: "merchant_admin",
        title: "Admin Entreprise",
        description: "Gérez votre entreprise et votre équipe",
        icon: Briefcase,
    },
    {
        role: "merchant_consultant",
        title: "Collaborateur d'une entreprise",
        description: "Collaborez avec une entreprise",
        icon: Users,
    },
    {
        role: "accountant",
        title: "Expert-comptable",
        description: "Créez un cabinet ou rejoignez un espace existant",
        icon: Calculator,
    },
    {
        role: "accountant_consultant",
        title: "Collaborateur Comptable",
        description: "Collaborez avec un cabinet comptable",
        icon: Users,
    },
];

const devMockFormData: FormData = {
    first_name: "Jean",
    last_name: "Dupont",
    email: "hakan9719@gmail.com",
    phone: "0612345678",
    password: "Test1234!",
    confirmPassword: "Test1234!",
    company_name: "Demo Company SARL",
    siren: "123456789",
    address: "10 rue de Paris",
    postal_code: "75001",
    city: "Paris",
    team_size: "2-5",
    accountant_siren: "",
};

const steps = [
    { id: 1, title: "Vos informations" },
    { id: 2, title: "Choix du plan" },
    { id: 3, title: "Paiement" },
];

const PLAN_DETAILS: Record<
    string,
    { description: string; features: string[] }
> = {
    essentiel: {
        description: "Pour démarrer votre activité",
        features: [
            "50 devis/mois",
            "25 factures/mois",
            "1 Go de stockage",
            "Signature électronique",
            "Export PDF",
        ],
    },
    business: {
        description: "Pour les professionnels",
        features: [
            "Devis illimités",
            "100 factures/mois",
            "5 Go de stockage",
            "Signature électronique",
            "Export PDF",
            "Support prioritaire",
            "Relances automatiques",
        ],
    },
    premium: {
        description: "Pour les équipes",
        features: [
            "Devis illimités",
            "Factures illimitées",
            "10 Go de stockage",
            "Signature électronique",
            "Export PDF",
            "Support prioritaire",
            "Relances automatiques",
            "Accès API",
        ],
    },
};

export function Register() {
    const formatPrice = (price: number) => price.toFixed(2).replace(".", ",");
    const { signUpWithEmail } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get("invite");
    const registrationPaymentSessionFromUrl = searchParams.get("registration_session");

    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>("essentiel");
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
        "monthly",
    );
    const [selectedRole, setSelectedRole] =
        useState<CompanyRole>("merchant_admin");
    const [companyCreationMode, setCompanyCreationMode] =
        useState<CompanyCreationMode>("create");
    const [inviteData, setInviteData] =
        useState<InviteValidationResponse | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    /** Aligné sur l’API : si true, Stripe est actif → pas de contournement paiement. */
    const [stripeEnabled, setStripeEnabled] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [accountCreated, setAccountCreated] = useState(false);
    const [paymentRegistrationSessionId, setPaymentRegistrationSessionId] = useState<string | null>(null);
    const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
    const [paymentInitError, setPaymentInitError] = useState<string | null>(null);
    const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
    const [isPreparingPayment, setIsPreparingPayment] = useState(false);
    const [isFinalizingPaidRegistration, setIsFinalizingPaidRegistration] = useState(false);
    const [legalConsentAccepted, setLegalConsentAccepted] = useState(false);
    const [legalConsentError, setLegalConsentError] = useState<string | null>(null);
    const [showPromoField, setShowPromoField] = useState(false);
    const [promoCode, setPromoCode] = useState("");
    const [promoValidation, setPromoValidation] =
        useState<RegistrationPricing | null>(null);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);
    const hasInitializedPromoReset = useRef(false);

    const [formData, setFormData] = useState<FormData>({
        ...((import.meta.env.DEV
            ? devMockFormData
            : {
                  first_name: "",
                  last_name: "",
                  email: "",
                  phone: "",
                  password: "",
                  confirmPassword: "",
                  company_name: "",
                  siren: "",
                  address: "",
                  postal_code: "",
                  city: "",
                  team_size: "",
                  accountant_siren: "",
              }) as FormData),
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>();
    const [selectedCompanySiret, setSelectedCompanySiret] = useState<string | undefined>();
    const [showAccountantField, setShowAccountantField] = useState(false);
    const [accountantDisplayName, setAccountantDisplayName] = useState<string | undefined>();
    const [registrationConflictSupportEmail, setRegistrationConflictSupportEmail] = useState<string | null>(null);
    const [errors, setErrors] = useState<
        Partial<Record<keyof FormData, string>>
    >({});

    const isFromInvite = Boolean(inviteData && inviteToken);
    const isMemberInvite = isFromInvite && inviteData?.invitation_type === "member";
    const isAccountantFirmInvite =
        isFromInvite && inviteData?.invitation_type === "accountant_firm";
    const isMerchantSignupInvite =
        isFromInvite && inviteData?.invitation_type === "merchant_signup";
    const isCompanyOwnerRole = COMPANY_OWNER_ROLES.includes(selectedRole);
    const canChooseCompanyCreationMode =
        (selectedRole === "accountant" && !isAccountantFirmInvite) ||
        (selectedRole === "merchant_admin" && isMemberInvite);
    const shouldCreateCompany =
        isCompanyOwnerRole && companyCreationMode === "create";
    const isJoinOnlyMode = isCompanyOwnerRole && companyCreationMode === "join_only";
    const requiresBillingSetup =
        selectedRole === "merchant_admin" && shouldCreateCompany;
    const currentSteps = requiresBillingSetup
        ? steps
        : [{ id: 1, title: "Vos informations" }];
    const companyCreationTitle =
        selectedRole === "accountant"
            ? "Cabinet comptable"
            : "Entreprise";
    const createCompanyModeLabel =
        selectedRole === "accountant"
            ? "Créer mon cabinet"
            : "Créer mon entreprise";
    const createCompanyModeDescription =
        selectedRole === "accountant"
            ? "Créez votre propre cabinet comptable dès l'inscription."
            : "Créez votre entreprise et configurez son abonnement.";
    const joinOnlyModeLabel =
        selectedRole === "accountant"
            ? "Continuer sans cabinet"
            : "Rejoindre l'entreprise invitante";
    const joinOnlyModeDescription =
        selectedRole === "accountant"
            ? "Créez uniquement votre compte personnel, sans cabinet."
            : "Créez uniquement votre compte personnel et rejoignez l'entreprise invitante.";
    const lockInvitedFirmIdentity = isAccountantFirmInvite;

    useEffect(() => {
        loadPlans();
    }, []);

    useEffect(() => {
        if (!requiresBillingSetup && currentStep !== 1) {
            setCurrentStep(1);
        }
    }, [requiresBillingSetup, currentStep]);

    useEffect(() => {
        if (shouldCreateCompany) {
            return;
        }

        setErrors((prev) => ({
            ...prev,
            company_name: undefined,
            siren: undefined,
        }));
        setRegistrationConflictSupportEmail(null);
    }, [shouldCreateCompany]);

    useEffect(() => {
        if (selectedRole === "merchant_admin") {
            setCompanyCreationMode(
                isMerchantSignupInvite ? "create" : isMemberInvite ? "join_only" : "create",
            );
            return;
        }

        if (selectedRole === "accountant") {
            if (isAccountantFirmInvite) {
                setCompanyCreationMode("create");
                return;
            }

            setCompanyCreationMode(isMemberInvite ? "join_only" : "create");
            return;
        }

        setCompanyCreationMode("join_only");
    }, [selectedRole, isMemberInvite, isAccountantFirmInvite, isMerchantSignupInvite]);

    useEffect(() => {
        if (searchParams.get("cancelled") === "true") {
            toast({
                title: "Paiement annulé",
                description: "Vous pouvez réessayer ou choisir un autre plan.",
                variant: "destructive",
            });
        }
    }, [searchParams, toast]);

    useEffect(() => {
        if (!registrationPaymentSessionFromUrl) {
            return;
        }

        setCurrentStep(3);
        setPaymentRegistrationSessionId(registrationPaymentSessionFromUrl);
        setPaymentClientSecret(null);

        const finalizeFromRedirect = async () => {
            setIsFinalizingPaidRegistration(true);
            setPaymentInitError(null);
            setPaymentStatusMessage(null);

            try {
                const result = await subscriptionService.finalizeRegistrationPayment(
                    registrationPaymentSessionFromUrl,
                );

                if (result.status === "completed") {
                    toast({
                        title: "Compte créé",
                        description: result.message,
                    });
                    navigate("/auth/login", { replace: true });
                    return;
                }

                setPaymentStatusMessage(result.message);
            } catch (error: any) {
                setPaymentInitError(
                    error.message ||
                        "Le paiement a bien été lancé, mais la création du compte n'a pas pu être finalisée automatiquement.",
                );
            } finally {
                setIsFinalizingPaidRegistration(false);
            }
        };

        void finalizeFromRedirect();
    }, [navigate, registrationPaymentSessionFromUrl, toast]);

    useEffect(() => {
        const validateInvite = async () => {
            if (!inviteToken) return;

            try {
                const data = await inviteService.validateToken(inviteToken);
                setInviteData(data);
                setSelectedRole(data.role);
                setFormData((prev) => ({
                    ...prev,
                    email: normalizeEmail(data.email),
                }));
            } catch (error: any) {
                toast({
                    title: "Invitation invalide",
                    description:
                        error.message ||
                        "Ce lien d'invitation est invalide ou expire.",
                    variant: "destructive",
                });
            }
        };

        validateInvite();
    }, [inviteToken, toast]);

    useEffect(() => {
        if (!inviteData || inviteData.invitation_type !== "accountant_firm") {
            return;
        }

        setSelectedCompanyName(inviteData.invited_firm_name || undefined);
        setSelectedCompanySiret(undefined);
        setRegistrationConflictSupportEmail(null);
        setFormData((prev) => ({
            ...prev,
            company_name: inviteData.invited_firm_name || prev.company_name,
            siren: inviteData.invited_firm_siren || prev.siren,
        }));
    }, [inviteData]);

    useEffect(() => {
        if (!inviteData || inviteData.invitation_type !== "merchant_signup") {
            return;
        }

        setSelectedCompanyName(inviteData.signup_company_name || undefined);
        setSelectedCompanySiret(inviteData.signup_siret || undefined);
        setRegistrationConflictSupportEmail(null);
        setFormData((prev) => ({
            ...prev,
            company_name: inviteData.signup_company_name || prev.company_name,
            siren: inviteData.signup_siren || prev.siren,
            address: inviteData.signup_address || prev.address,
            postal_code: inviteData.signup_postal_code || prev.postal_code,
            city: inviteData.signup_city || prev.city,
        }));
    }, [inviteData]);

    const loadPlans = async () => {
        try {
            const { plans: loadedPlans, stripe_enabled } =
                await subscriptionService.getPlans();
            setPlans(loadedPlans);
            setStripeEnabled(stripe_enabled);
        } catch {
            // Fallback to hardcoded plans if API is unavailable — ne pas exposer le bypass
            setStripeEnabled(true);
            setPlans([
                {
                    id: "essentiel",
                    name: "Essentiel",
                    slug: "essentiel",
                    description: null,
                    price_monthly: 9.9,
                    price_yearly: 99,
                    max_companies: null,
                    max_quotes_per_month: 50,
                    max_invoices_per_month: 25,
                    max_members: null,
                    max_storage_mb: 1000,
                    price_per_additional_member: 1.5,
                    features: [
                        "50 devis/mois",
                        "25 factures/mois",
                        "1 Go de stockage",
                        "Signature électronique",
                        "Export PDF",
                    ],
                    stripe_lookup_key_monthly: "essentiel_monthly",
                    stripe_lookup_key_yearly: "essentiel_yearly",
                    stripe_member_lookup_key: "member_addon",
                },
                {
                    id: "business",
                    name: "Business",
                    slug: "business",
                    description: null,
                    price_monthly: 12.9,
                    price_yearly: 129,
                    max_companies: null,
                    max_quotes_per_month: null,
                    max_invoices_per_month: 100,
                    max_members: null,
                    max_storage_mb: 5000,
                    price_per_additional_member: 1.5,
                    features: [
                        "Devis illimités",
                        "100 factures/mois",
                        "5 Go de stockage",
                        "Signature électronique",
                        "Export PDF",
                        "Support prioritaire",
                        "Relances automatiques",
                    ],
                    stripe_lookup_key_monthly: "business_monthly",
                    stripe_lookup_key_yearly: "business_yearly",
                    stripe_member_lookup_key: "member_addon",
                },
                {
                    id: "premium",
                    name: "Premium",
                    slug: "premium",
                    description: null,
                    price_monthly: 24.9,
                    price_yearly: 249,
                    max_companies: null,
                    max_quotes_per_month: null,
                    max_invoices_per_month: null,
                    max_members: null,
                    max_storage_mb: 10000,
                    price_per_additional_member: 1.5,
                    features: [
                        "Devis illimités",
                        "Factures illimitées",
                        "10 Go de stockage",
                        "Signature électronique",
                        "Export PDF",
                        "Support prioritaire",
                        "Relances automatiques",
                        "Accès API",
                    ],
                    stripe_lookup_key_monthly: "premium_monthly",
                    stripe_lookup_key_yearly: "premium_yearly",
                    stripe_member_lookup_key: "member_addon",
                },
            ]);
        } finally {
            setLoadingPlans(false);
        }
    };

    const handleSirenSelect = (result: SirenSearchResult) => {
        setFormData((prev) => ({
            ...prev,
            company_name: result.company_name || prev.company_name,
            siren: result.siren || prev.siren,
            address: result.address || prev.address,
            postal_code: result.postal_code || prev.postal_code,
            city: result.city || prev.city,
        }));
        setSelectedCompanyName(result.company_name);
        setSelectedCompanySiret(result.siret || undefined);
        setRegistrationConflictSupportEmail(null);
        toast({
            title: "Entreprise sélectionnée",
            description: `Les informations de ${result.company_name} ont été pré-remplies.`,
        });
    };

    const handleSirenClear = () => {
        setSelectedCompanyName(undefined);
        setSelectedCompanySiret(undefined);
        setRegistrationConflictSupportEmail(null);
        setFormData((prev) => ({
            ...prev,
            company_name: "",
            siren: "",
            address: "",
            postal_code: "",
            city: "",
        }));
    };

    const handleAccountantSelect = (result: SirenSearchResult) => {
        handleInputChange("accountant_siren", result.siren || "");
        setAccountantDisplayName(result.company_name || result.siren);
        toast({
            title: "Comptable sélectionné",
            description: `${result.company_name} a été sélectionné.`,
        });
    };

    const handleAccountantClear = () => {
        handleInputChange("accountant_siren", "");
        setAccountantDisplayName(undefined);
    };

    const resetPreparedPaymentState = () => {
        setPaymentRegistrationSessionId(null);
        setPaymentClientSecret(null);
        setPaymentInitError(null);
        setPaymentStatusMessage(null);
    };

    const selectedPlanData = plans.find((p) => p.slug === selectedPlan) || null;
    const selectedPriceHt = selectedPlanData
        ? billingPeriod === "yearly"
            ? selectedPlanData.price_yearly
            : selectedPlanData.price_monthly
        : 0;
    const basePricing: RegistrationPricing = {
        original_amount_ht: selectedPriceHt,
        discount_amount_ht: 0,
        final_amount_ht: selectedPriceHt,
        currency: "EUR",
        promotion_code: null,
        coupon_name: null,
        coupon_percent_off: null,
        coupon_amount_off: null,
    };
    const displayedPricing = promoValidation ?? basePricing;
    const displayedPriceTtc = displayedPricing.final_amount_ht * 1.2;
    const displayedOriginalPriceTtc = displayedPricing.original_amount_ht * 1.2;
    const paymentPrefill: PaymentFormBillingDetails = {
        email: formData.email,
        name: formData.company_name,
        address: {
            line1: formData.address,
            postal_code: formData.postal_code,
            city: formData.city,
            country: "FR",
        },
    };

    const platformLegalAcceptedAt = legalConsentAccepted
        ? new Date().toISOString()
        : undefined;

    const buildSignupMetadata = () => ({
        full_name: `${formData.first_name} ${formData.last_name}`,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || undefined,
        company_creation_mode: companyCreationMode,
        company_name: shouldCreateCompany ? formData.company_name : undefined,
        siren: shouldCreateCompany
            ? formData.siren.replace(/\s/g, "")
            : undefined,
        address: shouldCreateCompany
            ? formData.address || undefined
            : undefined,
        postal_code: shouldCreateCompany
            ? formData.postal_code || undefined
            : undefined,
        city: shouldCreateCompany ? formData.city || undefined : undefined,
        team_size: selectedRole === "merchant_admin" && shouldCreateCompany
            ? formData.team_size || undefined
            : undefined,
        country: "FR",
        plan_slug: requiresBillingSetup ? selectedPlan : undefined,
        role: selectedRole,
        accountant_siren:
            selectedRole === "merchant_admin" &&
            shouldCreateCompany &&
            formData.accountant_siren
                ? formData.accountant_siren.replace(/\s/g, "")
                : undefined,
        platform_legal_accepted_at: platformLegalAcceptedAt,
    });
    const isPaidPlan =
        selectedPlanData &&
        (billingPeriod === "yearly"
            ? selectedPlanData.price_yearly > 0
            : selectedPlanData.price_monthly > 0);
    const companySectionTitle =
        selectedRole === "accountant"
            ? "Votre cabinet comptable"
            : "Votre entreprise";
    const companyNameLabel =
        selectedRole === "accountant"
            ? "Nom du cabinet *"
            : "Nom de l'entreprise *";
    const companyNamePlaceholder =
        selectedRole === "accountant"
            ? "Cabinet Dupont Expertise"
            : "Ma Société SARL";

    useEffect(() => {
        if (!hasInitializedPromoReset.current) {
            hasInitializedPromoReset.current = true;
            return;
        }

        setPromoCode("");
        setPromoValidation(null);
        setPromoError(null);
        setShowPromoField(false);
        resetPreparedPaymentState();
    }, [selectedPlan, billingPeriod]);

    const validateStep1 = (): boolean => {
        const newErrors: Partial<Record<keyof FormData, string>> = {};

        if (!formData.first_name.trim())
            newErrors.first_name = "Le prénom est requis";
        if (!formData.last_name.trim())
            newErrors.last_name = "Le nom est requis";
        const normalizedEmail = normalizeEmail(formData.email);
        if (!normalizedEmail) newErrors.email = "L'email est requis";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            newErrors.email = "Format d'email invalide";
        }
        if (!formData.password)
            newErrors.password = "Le mot de passe est requis";
        else if (formData.password.length < 6) {
            newErrors.password =
                "Le mot de passe doit contenir au moins 6 caractères";
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword =
                "Les mots de passe ne correspondent pas";
        }

        if (shouldCreateCompany) {
            if (!formData.company_name.trim())
                newErrors.company_name =
                    selectedRole === "accountant"
                        ? "Le nom du cabinet est requis"
                        : "Le nom de l'entreprise est requis";
            if (!formData.siren.trim()) newErrors.siren = "Le SIREN est requis";
            else if (!/^\d{9}$/.test(formData.siren.replace(/\s/g, ""))) {
                newErrors.siren = "Le SIREN doit contenir 9 chiffres";
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            return false;
        }

        if (!legalConsentAccepted) {
            setLegalConsentError(
                "Vous devez accepter les CGV et la politique de confidentialité pour créer votre compte.",
            );
            return false;
        }

        setLegalConsentError(null);
        return true;
    };

    const handleInputChange = (field: keyof FormData, value: string) => {
        if (field === "email" && isFromInvite) return;
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (field === "siren" || field === "company_name") {
            setRegistrationConflictSupportEmail(null);
        }
        if (field === "siren") {
            setSelectedCompanySiret(undefined);
        }
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    const applyRegistrationConflict = (
        message: string,
        supportEmail?: string,
    ) => {
        setErrors((prev) => ({ ...prev, siren: message }));
        setRegistrationConflictSupportEmail(
            supportEmail || REGISTRATION_SUPPORT_EMAIL,
        );
        toast({
            title: "Inscription impossible",
            description: message,
            variant: "destructive",
        });
    };

    const checkCompanyRegistrationAvailability = async () => {
        if (!shouldCreateCompany) {
            return { available: true } as const;
        }

        const availability = await authService.checkRegistrationAvailability({
            siren: formData.siren,
            siret: selectedCompanySiret,
            role: selectedRole,
            country: "FR",
        });

        if (!availability.available) {
            applyRegistrationConflict(
                availability.message ||
                    "Cette entreprise est déjà associée à un compte SENED.",
                availability.supportEmail,
            );
        }

        return availability;
    };

    const handleNextStep = () => {
        if (validateStep1()) {
            if (requiresBillingSetup) {
                setCurrentStep(2);
            } else {
                void handleCreateAccount();
            }
        }
    };

    const handlePlanSelected = () => {
        if (isPaidPlan) {
            setPaymentClientSecret(null);
            setPaymentInitError(null);
            setCurrentStep(3);
            void handleStripeCheckout();
        } else {
            void handleCreateAccount();
        }
    };

    const handleCreateAccount = async (): Promise<boolean> => {
        setIsSubmitting(true);
        const normalizedEmail = normalizeEmail(formData.email);

        try {
            if (shouldCreateCompany) {
                try {
                    const availability =
                        await checkCompanyRegistrationAvailability();

                    if (!availability.available) {
                        return false;
                    }
                } catch (precheckError) {
                    console.warn(
                        "Pré-vérification d'inscription indisponible, poursuite du signup.",
                        precheckError,
                    );
                }
            }

            await signUpWithEmail(
                normalizedEmail,
                formData.password,
                buildSignupMetadata(),
            );

            setAccountCreated(true);

            if (!requiresBillingSetup || !isPaidPlan) {
                toast({
                    title: "Inscription réussie !",
                    description:
                        "Vérifiez votre email pour confirmer votre compte.",
                });
                navigate("/auth/login");
            }
            return true;
        } catch (error: any) {
            console.error("Erreur d'inscription:", error);
            if (
                shouldCreateCompany &&
                error.message === "Database error saving new user"
            ) {
                try {
                    const availability =
                        await checkCompanyRegistrationAvailability();
                    if (!availability.available) {
                        return false;
                    }
                } catch (availabilityError) {
                    console.warn(
                        "Impossible de confirmer le conflit d'entreprise après échec d'inscription.",
                        availabilityError,
                    );
                }
            }

            const description =
                error.message === "Database error saving new user"
                    ? `L'inscription n'a pas pu être finalisée. Si le problème persiste, contactez ${REGISTRATION_SUPPORT_EMAIL}.`
                    : error.message ||
                      "Une erreur est survenue lors de l'inscription.";
            toast({
                title: "Erreur d'inscription",
                description,
                variant: "destructive",
            });
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePromoCodeChange = (value: string) => {
        setPromoCode(value);
        setPromoError(null);

        if (
            promoValidation?.promotion_code &&
            promoValidation.promotion_code.toLowerCase() !== value.trim().toLowerCase()
        ) {
            setPromoValidation(null);
            resetPreparedPaymentState();
        }
    };

    const handleApplyPromoCode = async () => {
        const normalizedPromoCode = promoCode.trim();
        if (!normalizedPromoCode) {
            setPromoError("Saisissez un code promo.");
            setPromoValidation(null);
            return;
        }

        setIsApplyingPromo(true);
        setPromoError(null);

        try {
            const result = await subscriptionService.validateRegistrationPromotion({
                plan_slug: selectedPlan,
                billing_period: billingPeriod,
                promotion_code: normalizedPromoCode,
            });

            setPromoCode(result.pricing.promotion_code || normalizedPromoCode);
            setPromoValidation(result.pricing);
            resetPreparedPaymentState();
        } catch (error: any) {
            setPromoValidation(null);
            setPromoError(
                error.message || "Ce code promo n'a pas pu être appliqué.",
            );
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleRemovePromoCode = () => {
        setPromoCode("");
        setPromoValidation(null);
        setPromoError(null);
        resetPreparedPaymentState();
    };

    const handleStripeCheckout = async () => {
        setIsPreparingPayment(true);
        setPaymentClientSecret(null);
        setPaymentInitError(null);
        setPaymentStatusMessage(null);

        try {
            const metadata = buildSignupMetadata();
            const platformLegalAcceptedAt = metadata.platform_legal_accepted_at;

            if (!requiresBillingSetup || !platformLegalAcceptedAt) {
                throw new Error("Les informations d'inscription sont incomplètes.");
            }

            const result =
                await subscriptionService.createRegistrationPayment({
                    email: normalizeEmail(formData.email),
                    password: formData.password,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone: formData.phone || undefined,
                    company_creation_mode: "create",
                    company_name: formData.company_name,
                    siren: formData.siren.replace(/\s/g, ""),
                    siret: selectedCompanySiret,
                    address: formData.address || undefined,
                    postal_code: formData.postal_code || undefined,
                    city: formData.city || undefined,
                    country: "FR",
                    team_size:
                        selectedRole === "merchant_admin" && shouldCreateCompany
                            ? formData.team_size || undefined
                            : undefined,
                    role: "merchant_admin",
                    accountant_siren:
                        selectedRole === "merchant_admin" &&
                        shouldCreateCompany &&
                        formData.accountant_siren
                            ? formData.accountant_siren.replace(/\s/g, "")
                            : undefined,
                    plan_slug: selectedPlan,
                    billing_period: billingPeriod,
                    promotion_code: promoValidation?.promotion_code || undefined,
                    platform_legal_accepted_at: platformLegalAcceptedAt,
                });

            setPaymentRegistrationSessionId(result.registration_session_id);
            setPromoValidation(
                result.pricing.promotion_code ? result.pricing : null,
            );

            if (result.status === 'active') {
                const finalizeResult = await subscriptionService.finalizeRegistrationPayment(
                    result.registration_session_id,
                );
                if (finalizeResult.status === "completed") {
                    toast({
                        title: "Compte créé",
                        description: finalizeResult.message,
                    });
                    navigate("/auth/login");
                    return;
                }
                setPaymentStatusMessage(finalizeResult.message);
            } else if (result.client_secret) {
                setPaymentClientSecret(result.client_secret);
            } else {
                throw new Error("Impossible d'initialiser le paiement.");
            }
        } catch (error: any) {
            console.error("Erreur souscription:", error);
            const description =
                error.message ||
                "Impossible de créer l'abonnement.";
            if (description.toLowerCase().includes("code promo")) {
                setPromoValidation(null);
                setPromoError(description);
            }
            setPaymentInitError(description);
            toast({
                title: "Erreur de paiement",
                description,
                variant: "destructive",
            });
        } finally {
            setIsPreparingPayment(false);
        }
    };

    const handleInlinePaymentSuccess = async () => {
        if (!paymentRegistrationSessionId) {
            setPaymentInitError(
                "Paiement confirmé, mais la session d'inscription est introuvable.",
            );
            return;
        }

        setIsFinalizingPaidRegistration(true);
        setPaymentInitError(null);
        setPaymentStatusMessage(null);

        try {
            const result = await subscriptionService.finalizeRegistrationPayment(
                paymentRegistrationSessionId,
            );

            if (result.status === "completed") {
                toast({
                    title: "Compte créé",
                    description: result.message,
                });
                navigate("/auth/login");
                return;
            }

            setPaymentStatusMessage(result.message);
        } catch (error: any) {
            setPaymentInitError(
                error.message ||
                    "Le paiement a été confirmé, mais la création du compte n'a pas pu être finalisée automatiquement.",
            );
        } finally {
            setIsFinalizingPaidRegistration(false);
        }
    };

    const handleSkipPayment = async () => {
        setIsSubmitting(true);

        try {
            if (!requiresBillingSetup) {
                toast({
                    title: "Compte créé",
                    description:
                        "L'invitation ne nécessite pas d'abonnement personnel.",
                });
                navigate("/auth/login");
                return;
            }

            if (!accountCreated) {
                const created = await handleCreateAccount();
                if (!created) return;
            }

            const result =
                await subscriptionService.subscribe(selectedPlan, billingPeriod);

            toast({
                title: "Compte créé",
                description:
                    result.status === "active"
                        ? "Le paiement est temporairement ignoré. Vous pourrez l'activer plus tard."
                        : "Abonnement créé. Finalisez le paiement dans les paramètres.",
            });

            if (result.status === "active") {
                navigate("/dashboard?subscription=success");
            } else {
                navigate("/settings");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <Card className="relative z-10 w-full max-w-2xl border shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="mb-2 flex justify-start">
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="gap-1 px-2">
                                <ArrowLeft className="h-4 w-4" />
                                Retour à l'accueil
                            </Button>
                        </Link>
                    </div>
                    <Link
                        to="/"
                        className="mx-auto mb-4 flex items-center gap-2"
                    >
                        <img
                            src="/brand/secondaire/SVG/SECONDAIRE_bleu.svg"
                            alt="Sened"
                            className="h-8 w-auto"
                        />
                    </Link>
                    <CardTitle className="text-2xl font-bold">
                        Créer un compte
                    </CardTitle>
                    <CardDescription>
                        Commencez à gérer vos devis et factures
                    </CardDescription>
                    {requiresBillingSetup && (
                        <div className="pt-4">
                            <Stepper
                                steps={currentSteps}
                                currentStep={currentStep}
                            />
                        </div>
                    )}
                </CardHeader>

                <CardContent>
                    {/* Step 1: Personal & Company Info */}
                    {currentStep === 1 && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleNextStep();
                            }}
                            className="space-y-6"
                        >
                            {isFromInvite && inviteData && (
                                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 mt-0.5 text-primary" />
                                        <div>
                                            <p className="font-medium">
                                                Invitation détectée
                                            </p>
                                            <p className="text-muted-foreground">
                                                {isMerchantSignupInvite
                                                    ? `${inviteData.inviter_name} vous invite à créer votre entreprise puis à la lier au cabinet ${inviteData.company_name}.`
                                                    : (
                                                        <>
                                                            {inviteData.inviter_name} vous
                                                            invite à rejoindre{" "}
                                                            {inviteData.company_name}.
                                                        </>
                                                    )}
                                            </p>
                                            {isAccountantFirmInvite && (
                                                <p className="mt-2 text-muted-foreground">
                                                    Votre cabinet sera créé à
                                                    partir des informations de
                                                    l&apos;invitation, sans
                                                    abonnement personnel à
                                                    configurer.
                                                </p>
                                            )}
                                            {isMerchantSignupInvite && (
                                                <p className="mt-2 text-muted-foreground">
                                                    Les informations de votre entreprise sont préremplies à partir de l’invitation. Vous pouvez les ajuster avant de créer votre compte et de configurer l’abonnement.
                                                </p>
                                            )}
                                            {isMemberInvite && isJoinOnlyMode && (
                                                <p className="mt-2 text-muted-foreground">
                                                    {selectedRole === "accountant"
                                                        ? "Vous pouvez finaliser l'inscription avec vos informations personnelles, sans créer de cabinet."
                                                        : "Vous pouvez rejoindre l'entreprise invitante avec vos informations personnelles, sans créer d'entreprise ni d'abonnement personnel."}
                                                </p>
                                            )}
                                            {isMemberInvite &&
                                                !isJoinOnlyMode &&
                                                isCompanyOwnerRole && (
                                                <p className="mt-2 text-muted-foreground">
                                                    {selectedRole ===
                                                    "accountant"
                                                        ? "Votre cabinet sera créé pendant l'inscription avant votre rattachement."
                                                        : "Votre entreprise sera créée pendant l'inscription et votre invitation actuelle sera aussi acceptée."}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Quel est votre rôle ?
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {roleOptions.map((option) => {
                                        const Icon = option.icon;
                                        const isSelected =
                                            selectedRole === option.role;
                                        return (
                                            <button
                                                key={option.role}
                                                type="button"
                                                disabled={isFromInvite}
                                                onClick={() =>
                                                    setSelectedRole(option.role)
                                                }
                                                className={`text-left rounded-lg border p-4 transition ${
                                                    isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                } ${isFromInvite ? "cursor-not-allowed opacity-80" : ""}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Icon className="h-5 w-5 mt-0.5 text-primary" />
                                                    <div>
                                                        <p className="font-medium">
                                                            {option.title}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {option.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {isFromInvite && (
                                    <p className="text-xs text-muted-foreground">
                                        Le rôle est verrouillé car vous utilisez
                                        un lien d'invitation.
                                    </p>
                                )}
                            </div>

                            {canChooseCompanyCreationMode && (
                                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <Building2 className="h-5 w-5" />
                                            {companyCreationTitle}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedRole === "accountant"
                                                ? "Choisissez si vous créez votre propre cabinet ou si vous continuez avec un compte personnel uniquement."
                                                : "Choisissez si vous créez votre propre entreprise ou si vous rejoignez seulement l'entreprise invitante."}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCompanyCreationMode("create")
                                            }
                                            className={`rounded-lg border p-4 text-left transition ${
                                                companyCreationMode === "create"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <p className="font-medium">
                                                {createCompanyModeLabel}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {createCompanyModeDescription}
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCompanyCreationMode(
                                                    "join_only",
                                                )
                                            }
                                            className={`rounded-lg border p-4 text-left transition ${
                                                companyCreationMode ===
                                                "join_only"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <p className="font-medium">
                                                {joinOnlyModeLabel}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {joinOnlyModeDescription}
                                            </p>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Informations personnelles
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="first_name">
                                            Prénom *
                                        </Label>
                                        <Input
                                            id="first_name"
                                            type="text"
                                            placeholder="Jean"
                                            value={formData.first_name}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "first_name",
                                                    e.target.value,
                                                )
                                            }
                                            className={
                                                errors.first_name
                                                    ? "border-destructive"
                                                    : ""
                                            }
                                        />
                                        {errors.first_name && (
                                            <p className="text-xs text-destructive">
                                                {errors.first_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="last_name">Nom *</Label>
                                        <Input
                                            id="last_name"
                                            type="text"
                                            placeholder="Dupont"
                                            value={formData.last_name}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "last_name",
                                                    e.target.value,
                                                )
                                            }
                                            className={
                                                errors.last_name
                                                    ? "border-destructive"
                                                    : ""
                                            }
                                        />
                                        {errors.last_name && (
                                            <p className="text-xs text-destructive">
                                                {errors.last_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="jean.dupont@email.com"
                                            value={formData.email}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "email",
                                                    e.target.value,
                                                )
                                            }
                                            readOnly={isFromInvite}
                                            className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-xs text-destructive">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Téléphone</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="06 12 34 56 78"
                                            value={formData.phone}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "phone",
                                                    e.target.value,
                                                )
                                            }
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="password">
                                            Mot de passe *
                                        </Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "password",
                                                        e.target.value,
                                                    )
                                                }
                                                className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowPassword(
                                                        !showPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        {errors.password && (
                                            <p className="text-xs text-destructive">
                                                {errors.password}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">
                                            Confirmer *
                                        </Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="confirmPassword"
                                                type={
                                                    showConfirmPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                placeholder="••••••••"
                                                value={formData.confirmPassword}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "confirmPassword",
                                                        e.target.value,
                                                    )
                                                }
                                                className={`pl-10 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmPassword(
                                                        !showConfirmPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        {errors.confirmPassword && (
                                            <p className="text-xs text-destructive">
                                                {errors.confirmPassword}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {shouldCreateCompany && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        {companySectionTitle}
                                    </h3>
                                    {!lockInvitedFirmIdentity && (
                                        <EnterpriseLookupField
                                            mode="public"
                                            onSelect={handleSirenSelect}
                                            onClear={handleSirenClear}
                                            selectedName={selectedCompanyName}
                                        />
                                    )}
                                    {lockInvitedFirmIdentity && (
                                        <p className="text-sm text-muted-foreground">
                                            Les informations du cabinet
                                            proviennent de l&apos;invitation et
                                            ne peuvent pas être modifiées.
                                        </p>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2 sm:col-span-1">
                                            <Label htmlFor="company_name">
                                                {companyNameLabel}
                                            </Label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="company_name"
                                                    type="text"
                                                    placeholder={companyNamePlaceholder}
                                                    value={formData.company_name}
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            "company_name",
                                                            e.target.value,
                                                        )
                                                    }
                                                    readOnly={
                                                        lockInvitedFirmIdentity
                                                    }
                                                    className={`pl-10 ${errors.company_name ? "border-destructive" : ""} ${
                                                        lockInvitedFirmIdentity
                                                            ? "bg-muted"
                                                            : ""
                                                    }`}
                                                />
                                            </div>
                                            {errors.company_name && (
                                                <p className="text-xs text-destructive">
                                                    {errors.company_name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 col-span-2 sm:col-span-1">
                                            <Label htmlFor="siren">
                                                SIREN *
                                            </Label>
                                            <div className="relative">
                                                <FileText className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="siren"
                                                    type="text"
                                                    placeholder="123 456 789"
                                                    value={formData.siren}
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            "siren",
                                                            e.target.value,
                                                        )
                                                    }
                                                    readOnly={
                                                        lockInvitedFirmIdentity
                                                    }
                                                    className={`pl-10 ${errors.siren ? "border-destructive" : ""} ${
                                                        lockInvitedFirmIdentity
                                                            ? "bg-muted"
                                                            : ""
                                                    }`}
                                                    maxLength={11}
                                                />
                                            </div>
                                            {errors.siren && (
                                                <p className="text-xs text-destructive">
                                                    {errors.siren}
                                                </p>
                                            )}
                                            {registrationConflictSupportEmail && (
                                                <p className="text-xs text-muted-foreground">
                                                    Si vous pensez que cette entreprise
                                                    vous appartient, contactez{" "}
                                                    <a
                                                        href={`mailto:${registrationConflictSupportEmail}`}
                                                        className="underline underline-offset-2"
                                                    >
                                                        {registrationConflictSupportEmail}
                                                    </a>
                                                    .
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="address">
                                            Adresse
                                        </Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                            <Input
                                                id="address"
                                                type="text"
                                                placeholder="123 rue de Paris"
                                                value={formData.address}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "address",
                                                        e.target.value,
                                                    )
                                                }
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="postal_code">
                                                Code postal
                                            </Label>
                                            <Input
                                                id="postal_code"
                                                type="text"
                                                placeholder="75001"
                                                value={formData.postal_code}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "postal_code",
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={5}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="city">
                                                Ville
                                            </Label>
                                            <Input
                                                id="city"
                                                type="text"
                                                placeholder="Paris"
                                                value={formData.city}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "city",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedRole === "merchant_admin" &&
                                shouldCreateCompany && (
                                <div className="space-y-2">
                                    <Label htmlFor="team_size">
                                        Nombre d'utilisateurs prévu
                                    </Label>
                                    <Select
                                        value={formData.team_size}
                                        onValueChange={(value) =>
                                            handleInputChange(
                                                "team_size",
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger id="team_size">
                                            <SelectValue placeholder="Sélectionnez une taille" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">
                                                Juste moi
                                            </SelectItem>
                                            <SelectItem value="2-5">
                                                2 à 5
                                            </SelectItem>
                                            <SelectItem value="6-10">
                                                6 à 10
                                            </SelectItem>
                                            <SelectItem value="10+">
                                                Plus de 10
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {selectedRole === "merchant_admin" &&
                                shouldCreateCompany && (
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <Calculator className="h-5 w-5" />
                                            Comptable associé
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAccountantField(
                                                    !showAccountantField,
                                                );
                                                if (showAccountantField) {
                                                    handleAccountantClear();
                                                }
                                            }}
                                            className={`text-sm px-3 py-1 rounded-md border transition ${
                                                showAccountantField
                                                    ? "border-primary bg-primary/5 text-primary"
                                                    : "border-border text-muted-foreground hover:border-primary/50"
                                            }`}
                                        >
                                            {showAccountantField
                                                ? "Retirer"
                                                : "Ajouter"}
                                        </button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Vous pouvez associer un cabinet
                                        comptable à votre entreprise
                                        (optionnel).
                                    </p>
                                    {showAccountantField && (
                                        <div className="space-y-2">
                                            <EnterpriseLookupField
                                                mode="public"
                                                onSelect={handleAccountantSelect}
                                                onClear={handleAccountantClear}
                                                selectedName={accountantDisplayName}
                                                compact
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Si votre comptable n'est
                                                pas encore inscrit sur
                                                la plateforme,
                                                l'association sera faite
                                                automatiquement
                                                lorsqu'il s'inscrira.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-full bg-white p-2 shadow-sm">
                                        <Shield className="h-4 w-4 text-slate-700" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium text-slate-900">
                                            Cadre légal de votre compte
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            L’inscription nécessite l’acceptation des documents légaux de la plateforme.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <input
                                        id="legalConsent"
                                        type="checkbox"
                                        checked={legalConsentAccepted}
                                        onChange={(e) => {
                                            setLegalConsentAccepted(e.target.checked);
                                            if (e.target.checked) {
                                                setLegalConsentError(null);
                                            }
                                        }}
                                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor="legalConsent" className="cursor-pointer text-sm font-normal leading-6">
                                        J’ai lu et j’accepte les{" "}
                                        <Link to="/legal/cgv" target="_blank" className="font-medium underline underline-offset-4">
                                            CGV de la plateforme
                                        </Link>
                                        {" "}ainsi que la{" "}
                                        <Link to="/legal/confidentialite" target="_blank" className="font-medium underline underline-offset-4">
                                            politique de confidentialité
                                        </Link>
                                        .
                                    </Label>
                                </div>

                                {legalConsentError && (
                                    <p className="text-sm text-destructive">
                                        {legalConsentError}
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                            >
                                {requiresBillingSetup ? "Continuer" : "Créer mon compte"}
                            </Button>
                        </form>
                    )}

                    {/* Step 2: Plan Selection */}
                    {requiresBillingSetup && currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="font-semibold text-lg">
                                    Choisissez votre plan
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Vous pourrez changer de plan à tout moment
                                </p>
                            </div>

                            {/* Billing period toggle */}
                            <div className="flex items-center justify-center gap-1 rounded-lg border bg-muted p-1 w-fit mx-auto">
                                <button
                                    type="button"
                                    onClick={() => setBillingPeriod("monthly")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        billingPeriod === "monthly"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Mensuel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingPeriod("yearly")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                                        billingPeriod === "yearly"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Annuel
                                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                                        -2 mois
                                    </span>
                                </button>
                            </div>

                            {loadingPlans ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-3">
                                    {plans.map((plan) => {
                                        const displayPrice =
                                            billingPeriod === "yearly"
                                                ? plan.price_yearly
                                                : plan.price_monthly;
                                        const monthlyEquiv =
                                            billingPeriod === "yearly" &&
                                            plan.price_yearly > 0
                                                ? formatPrice(
                                                      plan.price_yearly / 12,
                                                  )
                                                : null;
                                        const details = PLAN_DETAILS[plan.slug];
                                        const description =
                                            plan.description ??
                                            details?.description;
                                        const featureList =
                                            plan.features.length > 0
                                                ? plan.features
                                                : (details?.features ?? []);
                                        return (
                                            <div
                                                key={plan.id}
                                                className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                                                    selectedPlan === plan.slug
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                }`}
                                                onClick={() =>
                                                    setSelectedPlan(plan.slug)
                                                }
                                            >
                                                {plan.slug === "business" && (
                                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                                                            Populaire
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="text-center mb-3">
                                                    <h4 className="font-semibold">
                                                        {plan.name}
                                                    </h4>
                                                    {description && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {description}
                                                        </p>
                                                    )}
                                                    <div className="mt-1">
                                                        <span className="text-2xl font-bold">
                                                            {displayPrice === 0
                                                                ? "Gratuit"
                                                                : `${formatPrice(displayPrice)}€`}
                                                        </span>
                                                        {displayPrice > 0 && (
                                                            <span className="text-sm text-muted-foreground">
                                                                {billingPeriod ===
                                                                "yearly"
                                                                    ? " HT/an"
                                                                    : " HT/mois"}
                                                            </span>
                                                        )}
                                                        {monthlyEquiv && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                soit{" "}
                                                                {monthlyEquiv}€
                                                                HT/mois
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ul className="space-y-1 text-sm">
                                                    {featureList.map(
                                                        (feature) => (
                                                            <li
                                                                key={feature}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                                                {feature}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                                {selectedPlan === plan.slug && (
                                                    <div className="absolute top-2 right-2">
                                                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCurrentStep(1)}
                                    className="flex-1"
                                >
                                    Retour
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handlePlanSelected}
                                    disabled={isSubmitting}
                                    className="flex-1"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Inscription...
                                        </>
                                    ) : isPaidPlan ? (
                                        "Continuer vers le paiement"
                                    ) : (
                                        "Créer mon compte"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment (paid plans only) */}
                    {requiresBillingSetup && currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Finaliser votre abonnement
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Paiement sécurisé
                                </p>
                            </div>

                            {selectedPlanData && (
                                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-semibold text-lg">
                                                {selectedPlanData.name}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                Abonnement{" "}
                                                {billingPeriod === "yearly"
                                                    ? "annuel"
                                                    : "mensuel"}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {displayedPricing.discount_amount_ht >
                                            0 ? (
                                                <p className="text-sm text-muted-foreground line-through">
                                                    {formatPrice(
                                                        displayedPricing.original_amount_ht,
                                                    )}
                                                    €{" "}
                                                    {billingPeriod === "yearly"
                                                        ? "HT/an"
                                                        : "HT/mois"}
                                                </p>
                                            ) : null}
                                            <span className="text-3xl font-bold">
                                                {formatPrice(
                                                    displayedPricing.final_amount_ht,
                                                )}
                                                €
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {billingPeriod === "yearly"
                                                    ? " HT/an"
                                                    : " HT/mois"}
                                            </span>
                                            {billingPeriod === "yearly" &&
                                                displayedPricing.final_amount_ht >
                                                    0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        soit{" "}
                                                        {formatPrice(
                                                            displayedPricing.final_amount_ht /
                                                                12,
                                                        )}
                                                        € HT/mois
                                                    </p>
                                                )}
                                            {displayedPricing.final_amount_ht >
                                                0 && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {formatPrice(
                                                        displayedPricing.final_amount_ht,
                                                    )}
                                                    € HT, soit{" "}
                                                    {formatPrice(
                                                        displayedPriceTtc,
                                                    )}
                                                    € TTC
                                                    {billingPeriod === "yearly"
                                                        ? "/an"
                                                        : "/mois"}
                                                </p>
                                            )}
                                            {displayedPricing.discount_amount_ht >
                                            0 && (
                                                <p className="text-xs font-medium text-emerald-700 mt-1">
                                                    Code{" "}
                                                    {displayedPricing.promotion_code}
                                                    {" "}appliqué
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm">
                                        {(
                                            selectedPlanData.features as string[]
                                        ).map((feature) => (
                                            <li
                                                key={feature}
                                                className="flex items-center gap-2"
                                            >
                                                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-4 rounded-lg border bg-background/80 p-4 space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">
                                                Prix initial
                                            </span>
                                            <span>
                                                {formatPrice(
                                                    displayedPricing.original_amount_ht,
                                                )}
                                                € HT
                                            </span>
                                        </div>
                                        {displayedPricing.discount_amount_ht >
                                            0 && (
                                            <div className="flex items-center justify-between text-emerald-700">
                                                <span>
                                                    Remise{" "}
                                                    {displayedPricing.coupon_name ||
                                                        displayedPricing.promotion_code}
                                                </span>
                                                <span>
                                                    -
                                                    {formatPrice(
                                                        displayedPricing.discount_amount_ht,
                                                    )}
                                                    € HT
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between font-medium pt-2 border-t">
                                            <span>Total</span>
                                            <span>
                                                {formatPrice(
                                                    displayedPricing.final_amount_ht,
                                                )}
                                                € HT
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Total TTC estimé</span>
                                            <span>
                                                {formatPrice(displayedPriceTtc)}
                                                € TTC
                                            </span>
                                        </div>
                                        {displayedPricing.discount_amount_ht >
                                            0 && (
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>Prix TTC initial</span>
                                                <span>
                                                    {formatPrice(
                                                        displayedOriginalPriceTtc,
                                                    )}
                                                    € TTC
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border bg-background">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPromoField(!showPromoField)
                                    }
                                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <TicketPercent className="h-4 w-4 text-primary" />
                                        J’ai un code promo
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {showPromoField
                                            ? "Masquer"
                                            : promoValidation?.promotion_code
                                              ? "Modifier"
                                              : "Ajouter"}
                                    </span>
                                </button>

                                {showPromoField && (
                                    <div className="border-t px-4 py-4 space-y-3">
                                        <div className="flex gap-2">
                                            <Input
                                                value={promoCode}
                                                onChange={(e) =>
                                                    handlePromoCodeChange(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Ex: BIENVENUE20"
                                                autoCapitalize="characters"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    void handleApplyPromoCode();
                                                }}
                                                disabled={
                                                    isApplyingPromo ||
                                                    !promoCode.trim()
                                                }
                                            >
                                                {isApplyingPromo ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Appliquer"
                                                )}
                                            </Button>
                                        </div>

                                        {promoValidation?.promotion_code && (
                                            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                                <div>
                                                    <p className="font-medium">
                                                        Code{" "}
                                                        {
                                                            promoValidation.promotion_code
                                                        }{" "}
                                                        appliqué
                                                    </p>
                                                    <p className="text-xs text-emerald-700">
                                                        Remise de{" "}
                                                        {formatPrice(
                                                            promoValidation.discount_amount_ht,
                                                        )}
                                                        € HT
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleRemovePromoCode}
                                                    className="h-8 px-2 text-emerald-700 hover:text-emerald-800"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}

                                        {promoError && (
                                            <p className="text-sm text-destructive">
                                                {promoError}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-muted-foreground">
                                    <p>
                                        Votre compte ne sera créé qu'après
                                        confirmation du paiement.
                                    </p>
                                    <p className="mt-1">
                                        En cas de délai bancaire, la création du
                                        compte se finalisera automatiquement dès
                                        validation du paiement.
                                    </p>
                                </div>
                            </div>

                            {isPreparingPayment && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Préparation du paiement sécurisé...
                                    </div>
                                </div>
                            )}

                            {isFinalizingPaidRegistration && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Finalisation de votre compte...
                                    </div>
                                </div>
                            )}

                            {!isPreparingPayment && !isFinalizingPaidRegistration && paymentStatusMessage && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                                    <p className="text-sm text-primary">
                                        {paymentStatusMessage}
                                    </p>
                                </div>
                            )}

                            {!isPreparingPayment && !isFinalizingPaidRegistration && paymentClientSecret && (
                                <div className="rounded-xl border border-primary/20 bg-background p-5 shadow-sm">
                                    <PaymentForm
                                        clientSecret={paymentClientSecret}
                                        onSuccess={() => {
                                            void handleInlinePaymentSuccess();
                                        }}
                                        returnUrl={`${window.location.origin}/auth/register?registration_session=${paymentRegistrationSessionId ?? ""}`}
                                        prefillBillingDetails={paymentPrefill}
                                    />
                                </div>
                            )}

                            {!isPreparingPayment && !paymentClientSecret && paymentInitError && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                                    <p className="text-sm text-destructive">
                                        {paymentInitError}
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleStripeCheckout}
                                        disabled={isPreparingPayment}
                                        className="w-full"
                                    >
                                        Réessayer l'initialisation du paiement
                                    </Button>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        resetPreparedPaymentState();
                                        setCurrentStep(2);
                                    }}
                                    className="flex-1"
                                >
                                    Retour
                                </Button>
                                {!paymentClientSecret && !isPreparingPayment && (
                                    <Button
                                        type="button"
                                        onClick={handleStripeCheckout}
                                        disabled={isPreparingPayment}
                                        className="flex-1"
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Charger le paiement
                                    </Button>
                                )}
                            </div>
                            {!stripeEnabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleSkipPayment}
                                    disabled={isSubmitting}
                                    className="w-full"
                                >
                                    Passer le paiement (temporaire)
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Déjà inscrit ?
                            </span>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link to="/auth/login">
                            <Button
                                variant="outline"
                                className="w-full"
                                size="lg"
                            >
                                Se connecter
                            </Button>
                        </Link>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        Les documents en vigueur restent consultables à tout moment dans nos{" "}
                        <Link to="/legal/cgv" className="underline hover:text-foreground">
                            CGV
                        </Link>
                        {" "}et notre{" "}
                        <Link to="/legal/confidentialite" className="underline hover:text-foreground">
                            politique de confidentialité
                        </Link>
                    </p>
                </CardContent>
            </Card>

            <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} SENED. Tous droits réservés.
            </div>
        </div>
    );
}
