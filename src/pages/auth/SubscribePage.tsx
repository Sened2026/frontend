import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Check,
    Loader2,
    MapPin,
    Phone,
    TicketPercent,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
    legalService,
    subscriptionService,
    type PendingCompanyPaymentSessionSummary,
    type RegistrationPricing,
    type SubscriptionPlan,
} from '@/services/api';
import { PaymentForm, type PaymentFormBillingDetails } from '@/components/PaymentForm';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import type { PlatformAcceptanceStatus } from '@/types';

const HIGHLIGHT_SLUG = 'business';
const INVALID_PENDING_PROMO_MESSAGE = 'Le code promo est invalide.';

function buildFeatures(plan: SubscriptionPlan): string[] {
    const features: string[] = [];
    features.push(
        plan.max_invoices_per_month
            ? `${plan.max_invoices_per_month} factures / mois`
            : 'Factures illimitées',
    );
    features.push(
        plan.max_quotes_per_month
            ? `${plan.max_quotes_per_month} devis / mois`
            : 'Devis illimités',
    );
    features.push('Avoirs illimités');
    features.push('Sociétés illimitées');
    features.push('Membres illimités');
    if (plan.max_storage_mb >= 10000) {
        features.push('10 Go de stockage');
    } else if (plan.max_storage_mb >= 5000) {
        features.push('5 Go de stockage');
    } else if (plan.max_storage_mb >= 1000) {
        features.push('1 Go de stockage');
    }
    return features;
}

function formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',');
}

function calcYearlySavings(monthly: number, yearly: number): number {
    const annualized = monthly * 12;
    if (annualized <= 0) return 0;
    return Math.round(((annualized - yearly) / annualized) * 100);
}

interface NavigationState {
    clientSecret?: string;
    selectedPlanSlug?: string;
    billingPeriod?: 'monthly' | 'yearly';
}

function PendingCompanySummaryCard({
    summary,
}: {
    summary: PendingCompanyPaymentSessionSummary['company_summary'];
}) {
    const addressParts = [
        summary.address,
        [summary.postal_code, summary.city].filter(Boolean).join(' '),
        summary.country,
    ].filter(Boolean);

    return (
        <Card className="mx-auto mb-6 w-full max-w-3xl text-left">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5" />
                    Entreprise qui sera ajoutée après paiement
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Nom
                        </p>
                        <p className="font-medium">{summary.name}</p>
                    </div>
                    {summary.legal_name && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Raison sociale
                            </p>
                            <p>{summary.legal_name}</p>
                        </div>
                    )}
                    {summary.siren && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                SIREN
                            </p>
                            <p>{summary.siren}</p>
                        </div>
                    )}
                    {summary.accountant_company_name && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Cabinet lié
                            </p>
                            <p>{summary.accountant_company_name}</p>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    {addressParts.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{addressParts.join(', ')}</span>
                        </div>
                    )}
                    {summary.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span>{summary.phone}</span>
                        </div>
                    )}
                    {summary.email && (
                        <div className="text-sm text-muted-foreground">
                            {summary.email}
                        </div>
                    )}
                    <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                        Cette entreprise n’est créée qu’après validation du paiement.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export function SubscribePage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const {
        currentCompany,
        setCurrentCompany,
        refreshCompanies,
    } = useCompany();
    const { refresh, canManageBilling, loading: subscriptionLoading } = useSubscription();
    const [searchParams] = useSearchParams();

    const navState = location.state as NavigationState | null;
    const pendingCompanySessionFromUrl = searchParams.get('pending_company_session');
    const isPendingCompanyFlow = Boolean(pendingCompanySessionFromUrl);

    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
        navState?.billingPeriod || 'monthly',
    );
    const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    const [clientSecret, setClientSecret] = useState<string | null>(
        navState?.clientSecret || null,
    );
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [platformAcceptanceStatus, setPlatformAcceptanceStatus] =
        useState<PlatformAcceptanceStatus | null>(null);
    const [legalConsentChecked, setLegalConsentChecked] = useState(false);
    const [legalLoading, setLegalLoading] = useState(true);

    const [showPromoField, setShowPromoField] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);

    const [pendingCompanySessionId, setPendingCompanySessionId] = useState<string | null>(
        pendingCompanySessionFromUrl,
    );
    const [pendingCompanySession, setPendingCompanySession] =
        useState<PendingCompanyPaymentSessionSummary | null>(null);
    const [loadingPendingCompanySession, setLoadingPendingCompanySession] =
        useState(isPendingCompanyFlow);
    const [pendingPricing, setPendingPricing] = useState<RegistrationPricing | null>(null);
    const [pendingPromoCode, setPendingPromoCode] = useState('');
    const [pendingPromoValidation, setPendingPromoValidation] =
        useState<RegistrationPricing | null>(null);
    const [pendingPromoError, setPendingPromoError] = useState<string | null>(null);
    const [isApplyingPendingPromo, setIsApplyingPendingPromo] = useState(false);
    const [isFinalizingPendingCompany, setIsFinalizingPendingCompany] = useState(false);
    const [pendingPaymentInitError, setPendingPaymentInitError] = useState<string | null>(null);
    const [pendingPaymentStatusMessage, setPendingPaymentStatusMessage] =
        useState<string | null>(null);

    const cancelled = searchParams.get('cancelled') === 'true';
    const userFullName =
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join(' ')
        || (typeof user?.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : '');
    const pendingCompanySummary = pendingCompanySession?.company_summary || null;
    const paymentPrefill: PaymentFormBillingDetails = isPendingCompanyFlow
        ? {
            email: pendingCompanySummary?.email || user?.email,
            name:
                pendingCompanySummary?.legal_name
                || pendingCompanySummary?.name
                || userFullName,
            address: {
                line1: pendingCompanySummary?.address || undefined,
                postal_code: pendingCompanySummary?.postal_code || undefined,
                city: pendingCompanySummary?.city || undefined,
                country: pendingCompanySummary?.country || undefined,
            },
        }
        : {
            email: user?.email,
            name: currentCompany?.name || userFullName,
            address: {
                line1: currentCompany?.address || undefined,
                postal_code: currentCompany?.postal_code || undefined,
                city: currentCompany?.city || undefined,
                country: currentCompany?.country || undefined,
            },
        };

    useEffect(() => {
        setPendingCompanySessionId(pendingCompanySessionFromUrl);
    }, [pendingCompanySessionFromUrl]);

    useEffect(() => {
        if (subscriptionLoading || isPendingCompanyFlow) {
            return;
        }

        if (currentCompany?.role === 'merchant_admin' && canManageBilling) {
            return;
        }

        toast({
            title: 'Accès indisponible',
            description: "La souscription est réservée à l'administrateur marchand.",
            variant: 'destructive',
        });
        navigate('/dashboard', { replace: true });
    }, [
        canManageBilling,
        currentCompany?.role,
        isPendingCompanyFlow,
        navigate,
        subscriptionLoading,
        toast,
    ]);

    const shouldBlockPage = !isPendingCompanyFlow
        && !subscriptionLoading
        && (currentCompany?.role !== 'merchant_admin' || !canManageBilling);

    useEffect(() => {
        subscriptionService.getPlans()
            .then(({ plans: loadedPlans }) => {
                setPlans(loadedPlans);

                if (navState?.clientSecret && navState?.selectedPlanSlug && !selectedPlan) {
                    const matchingPlan = loadedPlans.find(
                        (plan) => plan.slug === navState.selectedPlanSlug,
                    );
                    if (matchingPlan) {
                        setSelectedPlan(matchingPlan);
                    }
                }
            })
            .catch((err) => {
                console.error('Erreur chargement plans:', err);
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger les plans.',
                    variant: 'destructive',
                });
            })
            .finally(() => setLoadingPlans(false));
    }, [navState?.clientSecret, navState?.selectedPlanSlug, selectedPlan, toast]);

    useEffect(() => {
        const loadLegalContext = async () => {
            try {
                setLegalLoading(true);
                const status = await legalService.getPlatformAcceptanceStatus();
                setPlatformAcceptanceStatus(status);
            } catch (error: any) {
                toast({
                    title: 'Erreur',
                    description: error.message || 'Impossible de charger les documents légaux.',
                    variant: 'destructive',
                });
            } finally {
                setLegalLoading(false);
            }
        };

        void loadLegalContext();
    }, [toast]);

    useEffect(() => {
        if (!pendingCompanySessionFromUrl) {
            setPendingCompanySession(null);
            setLoadingPendingCompanySession(false);
            return;
        }

        const loadPendingSession = async () => {
            try {
                setLoadingPendingCompanySession(true);
                const session = await subscriptionService.getPendingCompanyPaymentSession(
                    pendingCompanySessionFromUrl,
                );
                setPendingCompanySession(session);
                setPendingCompanySessionId(session.session_id);

                if (session.company && session.status === 'completed') {
                    setCurrentCompany(session.company);
                    await Promise.all([refreshCompanies(), refresh()]);
                    navigate('/dashboard?subscription=success', { replace: true });
                }
            } catch (error: any) {
                toast({
                    title: 'Erreur',
                    description:
                        error.message
                        || 'Impossible de charger la session de création d’entreprise.',
                    variant: 'destructive',
                });
                navigate('/companies', { replace: true });
            } finally {
                setLoadingPendingCompanySession(false);
            }
        };

        void loadPendingSession();
    }, [
        navigate,
        pendingCompanySessionFromUrl,
        refresh,
        refreshCompanies,
        setCurrentCompany,
        toast,
    ]);

    const finalizePendingCompanyPayment = async (sessionId: string) => {
        setIsFinalizingPendingCompany(true);
        setPendingPaymentInitError(null);
        setPendingPaymentStatusMessage(null);

        try {
            const result = await subscriptionService.finalizePendingCompanySubscription(
                sessionId,
            );

            if (result.status === 'completed' && result.company) {
                setCurrentCompany(result.company);
                await Promise.all([refreshCompanies(), refresh()]);
                navigate('/dashboard?subscription=success', { replace: true });
                return;
            }

            setPendingPaymentStatusMessage(result.message);
        } catch (error: any) {
            setPendingPaymentInitError(
                error.message
                || "Le paiement a été confirmé, mais la création de l'entreprise n'a pas pu être finalisée automatiquement.",
            );
        } finally {
            setIsFinalizingPendingCompany(false);
        }
    };

    useEffect(() => {
        if (!pendingCompanySessionFromUrl) {
            return;
        }

        const hasStripeRedirectParams =
            Boolean(searchParams.get('payment_intent'))
            || Boolean(searchParams.get('payment_intent_client_secret'))
            || Boolean(searchParams.get('redirect_status'));

        if (!hasStripeRedirectParams) {
            return;
        }

        void finalizePendingCompanyPayment(pendingCompanySessionFromUrl);
    }, [pendingCompanySessionFromUrl, searchParams]);

    const ensureLegalAcceptance = async () => {
        if (!platformAcceptanceStatus?.requires_acceptance) {
            return true;
        }

        if (!legalConsentChecked) {
            toast({
                title: 'Validation requise',
                description:
                    'Vous devez accepter les CGV et la politique de confidentialité avant de continuer.',
                variant: 'destructive',
            });
            return false;
        }

        const accepted = await legalService.acceptCurrentPlatformDocuments();
        setPlatformAcceptanceStatus(accepted);
        setLegalConsentChecked(false);
        return true;
    };

    const handleChoosePlan = async (plan: SubscriptionPlan) => {
        try {
            setLoadingSlug(plan.slug);

            const canContinue = await ensureLegalAcceptance();
            if (!canContinue) {
                return;
            }

            if (isPendingCompanyFlow) {
                const sessionId = pendingCompanySessionId || pendingCompanySessionFromUrl;
                if (!sessionId) {
                    throw new Error(
                        "La session de création d'entreprise est introuvable.",
                    );
                }

                setPendingPromoValidation(null);
                setPendingPromoError(null);
                setPendingPricing(null);
                setPendingPaymentInitError(null);
                setPendingPaymentStatusMessage(null);

                const result = await subscriptionService.createPendingCompanySubscription({
                    session_id: sessionId,
                    plan_slug: plan.slug,
                    billing_period: billingPeriod,
                });

                setPendingCompanySessionId(result.session_id);
                setSelectedPlan(plan);
                setPendingPricing(result.pricing);

                if (result.status === 'active' && !result.client_secret) {
                    await finalizePendingCompanyPayment(result.session_id);
                    return;
                }

                if (!result.client_secret) {
                    throw new Error("Impossible d'initialiser le paiement.");
                }

                setClientSecret(result.client_secret);
                return;
            }

            const normalizedPromoCode = promoCode.trim();
            const result = await subscriptionService.subscribe(
                plan.slug,
                billingPeriod,
                normalizedPromoCode || undefined,
            );

            if (result.status === 'active') {
                await refresh();
                navigate('/dashboard?subscription=success');
                return;
            }

            if (result.client_secret) {
                setSelectedPlan(plan);
                setClientSecret(result.client_secret);
            } else {
                toast({
                    title: 'Erreur',
                    description: "Impossible d'initialiser le paiement.",
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Erreur souscription:', error);
            toast({
                title: 'Erreur',
                description: error.message || "Impossible de créer l'abonnement.",
                variant: 'destructive',
            });
        } finally {
            setLoadingSlug(null);
        }
    };

    const handlePaymentSuccess = async () => {
        if (isPendingCompanyFlow) {
            const sessionId = pendingCompanySessionId || pendingCompanySessionFromUrl;
            if (!sessionId) {
                setPendingPaymentInitError(
                    "La session de création d'entreprise est introuvable.",
                );
                return;
            }

            await finalizePendingCompanyPayment(sessionId);
            return;
        }

        await refresh();
        navigate('/dashboard?subscription=success');
    };

    const handleBackToPlans = () => {
        setClientSecret(null);
        setSelectedPlan(null);
        if (isPendingCompanyFlow) {
            setPendingPromoValidation(null);
            setPendingPromoError(null);
            setPendingPricing(null);
            setPendingPaymentInitError(null);
            setPendingPaymentStatusMessage(null);
        }
    };

    const handleApplyPromoCode = () => {
        const normalizedCode = promoCode.trim();
        if (!normalizedCode) {
            setPromoError('Saisissez un code promo avant de valider.');
            return;
        }

        setPromoError(null);
        setPromoApplied(true);
    };

    const clearPromoCode = () => {
        setPromoCode('');
        setPromoApplied(false);
        setPromoError(null);
        setShowPromoField(false);
    };

    const handlePendingPromoCodeChange = (value: string) => {
        setPendingPromoCode(value);
        setPendingPromoError(null);

        if (
            pendingPromoValidation?.promotion_code
            && pendingPromoValidation.promotion_code.toLowerCase()
                !== value.trim().toLowerCase()
        ) {
            setPendingPromoValidation(null);
        }
    };

    const handleApplyPendingPromoCode = async () => {
        const normalizedCode = pendingPromoCode.trim();
        const sessionId = pendingCompanySessionId || pendingCompanySessionFromUrl;

        if (!normalizedCode) {
            setPendingPromoError('Saisissez un code promo.');
            return;
        }

        if (!sessionId || !selectedPlan) {
            setPendingPromoError(
                "La session de paiement n'est pas prête pour appliquer un code promo.",
            );
            return;
        }

        try {
            setIsApplyingPendingPromo(true);
            setPendingPromoError(null);
            setPendingPaymentInitError(null);

            const validation =
                await subscriptionService.validatePendingCompanyPromotion({
                    session_id: sessionId,
                    plan_slug: selectedPlan.slug,
                    billing_period: billingPeriod,
                    promotion_code: normalizedCode,
                });

            const result = await subscriptionService.createPendingCompanySubscription({
                session_id: sessionId,
                plan_slug: selectedPlan.slug,
                billing_period: billingPeriod,
                promotion_code: normalizedCode,
            });

            setPendingCompanySessionId(result.session_id);
            setPendingPromoCode(
                validation.pricing.promotion_code || normalizedCode,
            );
            setPendingPromoValidation(validation.pricing);
            setPendingPricing(result.pricing);

            if (result.status === 'active' && !result.client_secret) {
                await finalizePendingCompanyPayment(result.session_id);
                return;
            }

            if (!result.client_secret) {
                throw new Error("Impossible d'initialiser le paiement.");
            }

            setClientSecret(result.client_secret);
        } catch {
            setPendingPromoValidation(null);
            setPendingPromoError(INVALID_PENDING_PROMO_MESSAGE);
        } finally {
            setIsApplyingPendingPromo(false);
        }
    };

    const handleRemovePendingPromoCode = async () => {
        const sessionId = pendingCompanySessionId || pendingCompanySessionFromUrl;
        if (!sessionId || !selectedPlan) {
            setPendingPromoCode('');
            setPendingPromoValidation(null);
            setPendingPromoError(null);
            return;
        }

        try {
            setIsApplyingPendingPromo(true);
            const result = await subscriptionService.createPendingCompanySubscription({
                session_id: sessionId,
                plan_slug: selectedPlan.slug,
                billing_period: billingPeriod,
            });

            setPendingPromoCode('');
            setPendingPromoValidation(null);
            setPendingPromoError(null);
            setPendingPricing(result.pricing);

            if (result.status === 'active' && !result.client_secret) {
                await finalizePendingCompanyPayment(result.session_id);
                return;
            }

            if (!result.client_secret) {
                throw new Error("Impossible d'initialiser le paiement.");
            }

            setClientSecret(result.client_secret);
        } catch (error: any) {
            setPendingPaymentInitError(
                error.message || "Impossible de réinitialiser le paiement.",
            );
        } finally {
            setIsApplyingPendingPromo(false);
        }
    };

    if (shouldBlockPage) {
        return null;
    }

    const displayPrice = isPendingCompanyFlow && pendingPricing
        ? pendingPricing.final_amount_ht
        : billingPeriod === 'yearly'
            ? selectedPlan?.price_yearly || 0
            : selectedPlan?.price_monthly || 0;
    const periodLabel = billingPeriod === 'yearly' ? '/an' : '/mois';

    if (clientSecret && selectedPlan) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
                <div className="mx-auto w-full max-w-3xl">
                    <button
                        onClick={handleBackToPlans}
                        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour aux forfaits
                    </button>

                    {pendingCompanySummary && (
                        <PendingCompanySummaryCard summary={pendingCompanySummary} />
                    )}

                    <Card className="mx-auto max-w-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">
                                {isPendingCompanyFlow
                                    ? "Finaliser l'ajout de l'entreprise"
                                    : 'Finaliser votre abonnement'}
                            </CardTitle>
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {selectedPlan.name} — {billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}
                                </span>
                                <span className="text-xl font-bold">
                                    {formatPrice(displayPrice)} € HT{periodLabel}
                                </span>
                            </div>
                            {isPendingCompanyFlow
                                && pendingPricing
                                && pendingPricing.discount_amount_ht > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Prix initial : {formatPrice(pendingPricing.original_amount_ht)} € HT
                                    </p>
                                )}
                            {selectedPlan.price_per_additional_member > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    + {formatPrice(selectedPlan.price_per_additional_member)} € HT / membre suppl. / mois
                                </p>
                            )}
                        </CardHeader>
                        <CardContent>
                            {platformAcceptanceStatus?.requires_acceptance && (
                                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                    L’acceptation des documents légaux doit être finalisée avant la création d’un nouvel abonnement.
                                </div>
                            )}

                            {isPendingCompanyFlow && (
                                <div className="mb-4 rounded-xl border bg-card p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 font-medium">
                                            <TicketPercent className="h-4 w-4 text-primary" />
                                            Code promo
                                        </div>
                                        {pendingPromoValidation?.promotion_code && (
                                            <span className="text-xs text-emerald-700">
                                                {pendingPromoValidation.promotion_code} appliqué
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <input
                                            value={pendingPromoCode}
                                            onChange={(e) =>
                                                handlePendingPromoCodeChange(e.target.value)
                                            }
                                            placeholder="Ex: BIENVENUE20"
                                            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                void handleApplyPendingPromoCode();
                                            }}
                                            disabled={isApplyingPendingPromo || !pendingPromoCode.trim()}
                                        >
                                            {isApplyingPendingPromo ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                'Appliquer'
                                            )}
                                        </Button>
                                        {pendingPromoValidation?.promotion_code && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => {
                                                    void handleRemovePendingPromoCode();
                                                }}
                                                disabled={isApplyingPendingPromo}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {pendingPromoValidation?.promotion_code && (
                                        <p className="mt-2 text-sm text-emerald-700">
                                            Remise de {formatPrice(pendingPromoValidation.discount_amount_ht)} € HT
                                        </p>
                                    )}
                                    {pendingPromoError && (
                                        <p className="mt-2 text-sm text-destructive">
                                            {pendingPromoError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {pendingPaymentStatusMessage && (
                                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                    <p className="text-sm text-primary">
                                        {pendingPaymentStatusMessage}
                                    </p>
                                </div>
                            )}

                            {pendingPaymentInitError && (
                                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                    <p className="text-sm text-destructive">
                                        {pendingPaymentInitError}
                                    </p>
                                </div>
                            )}

                            {isFinalizingPendingCompany && (
                                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Finalisation de l'entreprise en cours...
                                    </div>
                                </div>
                            )}

                            <PaymentForm
                                clientSecret={clientSecret}
                                onSuccess={() => {
                                    void handlePaymentSuccess();
                                }}
                                returnUrl={
                                    isPendingCompanyFlow && pendingCompanySessionId
                                        ? `${window.location.origin}/subscribe?pending_company_session=${pendingCompanySessionId}`
                                        : `${window.location.origin}/dashboard?subscription=success`
                                }
                                prefillBillingDetails={paymentPrefill}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl text-center">
                {loadingPendingCompanySession ? (
                    <div className="mx-auto mb-6 max-w-3xl rounded-2xl border bg-card p-6">
                        <Skeleton className="h-6 w-64" />
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                ) : pendingCompanySummary ? (
                    <PendingCompanySummaryCard summary={pendingCompanySummary} />
                ) : null}

                <h1 className="text-3xl font-bold">Choisissez votre forfait</h1>
                <p className="mt-2 text-muted-foreground">
                    Un abonnement est nécessaire pour utiliser SENED. Tous les prix sont HT.
                </p>

                {legalLoading ? (
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement des documents légaux…
                    </div>
                ) : platformAcceptanceStatus?.requires_acceptance ? (
                    <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm">
                        <p className="text-sm font-medium text-slate-900">
                            Acceptation requise avant souscription
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Vous devez accepter les documents légaux de la plateforme avant de créer ou modifier l’abonnement.
                        </p>
                        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <input
                                type="checkbox"
                                checked={legalConsentChecked}
                                onChange={(e) => setLegalConsentChecked(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-slate-700">
                                J’accepte{' '}
                                <Link to="/legal/cgv" target="_blank" className="font-medium underline underline-offset-4">
                                    les CGV
                                </Link>
                                {' '}et{' '}
                                <Link to="/legal/confidentialite" target="_blank" className="font-medium underline underline-offset-4">
                                    la politique de confidentialité
                                </Link>
                                .
                            </span>
                        </label>
                    </div>
                ) : null}

                <div className="mt-6 inline-flex items-center rounded-lg border bg-muted p-1">
                    <button
                        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                            billingPeriod === 'monthly'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setBillingPeriod('monthly')}
                    >
                        Mensuel
                    </button>
                    <button
                        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                            billingPeriod === 'yearly'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setBillingPeriod('yearly')}
                    >
                        Annuel
                        {plans.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                -{calcYearlySavings(
                                    plans[1]?.price_monthly || plans[0]?.price_monthly || 0,
                                    ((plans[1]?.price_yearly || plans[0]?.price_yearly || 0) / 12) * 12,
                                )}%
                            </span>
                        )}
                    </button>
                </div>

                {!isPendingCompanyFlow && (
                    <div className="mx-auto mt-4 max-w-xl text-left">
                        {!showPromoField ? (
                            <button
                                type="button"
                                onClick={() => setShowPromoField(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                                <TicketPercent className="h-4 w-4" />
                                Ajouter un code promo
                            </button>
                        ) : (
                            <div className="rounded-xl border bg-card p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        value={promoCode}
                                        onChange={(e) => {
                                            setPromoCode(e.target.value);
                                            setPromoApplied(false);
                                            setPromoError(null);
                                        }}
                                        placeholder="Entrez votre code promo"
                                        className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleApplyPromoCode}
                                    >
                                        Valider
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={clearPromoCode}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                {promoApplied && (
                                    <p className="mt-2 text-sm text-emerald-600">
                                        Code promo ajouté. Il sera vérifié au paiement.
                                    </p>
                                )}
                                {promoError && (
                                    <p className="mt-2 text-sm text-destructive">
                                        {promoError}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {cancelled && (
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Le paiement a été annulé. Vous pouvez réessayer.
                    </div>
                )}

                {loadingPlans ? (
                    <div className="mt-8 grid gap-6 md:grid-cols-3">
                        {[...Array(3)].map((_, index) => (
                            <Skeleton key={index} className="h-72 rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <div className="mt-8 grid gap-6 md:grid-cols-3">
                        {plans.map((plan) => {
                            const isHighlight = plan.slug === HIGHLIGHT_SLUG;
                            const features = buildFeatures(plan);
                            const price =
                                billingPeriod === 'yearly'
                                    ? plan.price_yearly
                                    : plan.price_monthly;
                            const periodText =
                                billingPeriod === 'yearly' ? 'HT/an' : 'HT/mois';
                            const savings = calcYearlySavings(
                                plan.price_monthly,
                                plan.price_yearly,
                            );

                            return (
                                <Card
                                    key={plan.slug}
                                    className={`relative ${isHighlight ? 'border-primary shadow-lg' : ''}`}
                                >
                                    {isHighlight && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                                            Populaire
                                        </div>
                                    )}
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                                        <div className="text-3xl font-bold">
                                            {formatPrice(price)}€
                                            <span className="text-sm font-normal text-muted-foreground">
                                                {' '}{periodText}
                                            </span>
                                        </div>
                                        {billingPeriod === 'yearly' && savings > 0 && (
                                            <p className="text-xs font-medium text-green-600">
                                                Économisez {savings}% vs mensuel
                                            </p>
                                        )}
                                        {billingPeriod === 'monthly' && (
                                            <p className="text-xs text-muted-foreground">
                                                ou {formatPrice(plan.price_yearly)} € HT/an
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <ul className="space-y-2 text-left text-sm">
                                            {features.map((feature) => (
                                                <li key={feature} className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 shrink-0 text-primary" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-muted-foreground">
                                            + {formatPrice(plan.price_per_additional_member)} € HT / membre suppl. / mois
                                        </p>
                                        <Button
                                            className="w-full"
                                            variant={isHighlight ? 'default' : 'outline'}
                                            onClick={() => {
                                                void handleChoosePlan(plan);
                                            }}
                                            disabled={loadingSlug !== null || loadingPendingCompanySession}
                                        >
                                            {loadingSlug === plan.slug ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                'Choisir ce forfait'
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <p className="mt-6 text-xs text-muted-foreground">
                    Propriétaire inclus dans le prix de base. Facturation par siège à partir du 2e membre.
                </p>
            </div>
        </div>
    );
}

export default SubscribePage;
