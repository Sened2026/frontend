import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { legalService, subscriptionService, type SubscriptionPlan } from '@/services/api';
import { PaymentForm, type PaymentFormBillingDetails } from '@/components/PaymentForm';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import type { PlatformAcceptanceStatus } from '@/types';

const HIGHLIGHT_SLUG = 'business';

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

export function SubscribePage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { currentCompany } = useCompany();
    const { refresh, canManageBilling, loading: subscriptionLoading } = useSubscription();
    const [searchParams] = useSearchParams();

    const navState = location.state as NavigationState | null;

    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
        navState?.billingPeriod || 'monthly',
    );
    const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    // Payment form state
    const [clientSecret, setClientSecret] = useState<string | null>(navState?.clientSecret || null);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [platformAcceptanceStatus, setPlatformAcceptanceStatus] = useState<PlatformAcceptanceStatus | null>(null);
    const [legalConsentChecked, setLegalConsentChecked] = useState(false);
    const [legalLoading, setLegalLoading] = useState(true);

    const cancelled = searchParams.get('cancelled') === 'true';
    const userFullName =
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join(' ')
        || (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
    const paymentPrefill: PaymentFormBillingDetails = {
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
        if (subscriptionLoading) {
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
    }, [canManageBilling, currentCompany?.role, navigate, subscriptionLoading, toast]);

    const shouldBlockPage =
        !subscriptionLoading && (currentCompany?.role !== 'merchant_admin' || !canManageBilling);

    useEffect(() => {
        subscriptionService.getPlans()
            .then(({ plans: loadedPlans }) => {
                setPlans(loadedPlans);

                // If arriving from Register with a clientSecret, find the matching plan
                if (navState?.clientSecret && navState?.selectedPlanSlug && !selectedPlan) {
                    const matchingPlan = loadedPlans.find(p => p.slug === navState.selectedPlanSlug);
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
    }, []);

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

    const handleChoosePlan = async (plan: SubscriptionPlan) => {
        try {
            setLoadingSlug(plan.slug);
            if (platformAcceptanceStatus?.requires_acceptance) {
                if (!legalConsentChecked) {
                    toast({
                        title: 'Validation requise',
                        description: 'Vous devez accepter les CGV et la politique de confidentialité avant de continuer.',
                        variant: 'destructive',
                    });
                    return;
                }

                const accepted = await legalService.acceptCurrentPlatformDocuments();
                setPlatformAcceptanceStatus(accepted);
                setLegalConsentChecked(false);
            }

            const result = await subscriptionService.subscribe(plan.slug, billingPeriod);

            if (result.status === 'active') {
                // Already active (e.g. bypass mode or payment method on file)
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
                    description: 'Impossible d\'initialiser le paiement.',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Erreur souscription:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de créer l\'abonnement.',
                variant: 'destructive',
            });
        } finally {
            setLoadingSlug(null);
        }
    };

    const handlePaymentSuccess = async () => {
        await refresh();
        navigate('/dashboard?subscription=success');
    };

    const handleBackToPlans = () => {
        setClientSecret(null);
        setSelectedPlan(null);
    };

    if (shouldBlockPage) {
        return null;
    }

    // Payment form view
    if (clientSecret && selectedPlan) {
        const price = billingPeriod === 'yearly' ? selectedPlan.price_yearly : selectedPlan.price_monthly;
        const periodLabel = billingPeriod === 'yearly' ? '/an' : '/mois';

        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
                <div className="mx-auto w-full max-w-md">
                    <button
                        onClick={handleBackToPlans}
                        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour aux forfaits
                    </button>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Finaliser votre abonnement</CardTitle>
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {selectedPlan.name} — {billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}
                                </span>
                                <span className="text-xl font-bold">
                                    {formatPrice(price)} € HT{periodLabel}
                                </span>
                            </div>
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
                            <PaymentForm
                                clientSecret={clientSecret}
                                onSuccess={handlePaymentSuccess}
                                returnUrl={`${window.location.origin}/dashboard?subscription=success`}
                                prefillBillingDetails={paymentPrefill}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // Plan selection view
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl text-center">
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
                                J’accepte{" "}
                                <Link to="/legal/cgv" target="_blank" className="font-medium underline underline-offset-4">
                                    les CGV
                                </Link>
                                {" "}et{" "}
                                <Link to="/legal/confidentialite" target="_blank" className="font-medium underline underline-offset-4">
                                    la politique de confidentialité
                                </Link>
                                .
                            </span>
                        </label>
                    </div>
                ) : null}

                {/* Billing period toggle */}
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
                                -{calcYearlySavings(plans[1]?.price_monthly || plans[0]?.price_monthly || 0, (plans[1]?.price_yearly || plans[0]?.price_yearly || 0) / 12 * 12)}%
                            </span>
                        )}
                    </button>
                </div>

                {cancelled && (
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Le paiement a été annulé. Vous pouvez réessayer.
                    </div>
                )}

                {loadingPlans ? (
                    <div className="mt-8 grid gap-6 md:grid-cols-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-72 rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <div className="mt-8 grid gap-6 md:grid-cols-3">
                        {plans.map((plan) => {
                            const isHighlight = plan.slug === HIGHLIGHT_SLUG;
                            const features = buildFeatures(plan);
                            const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
                            const periodLabel = billingPeriod === 'yearly' ? 'HT/an' : 'HT/mois';
                            const savings = calcYearlySavings(plan.price_monthly, plan.price_yearly);

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
                                                {' '}{periodLabel}
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
                                        <ul className="space-y-2 text-sm text-left">
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
                                            onClick={() => handleChoosePlan(plan)}
                                            disabled={loadingSlug !== null}
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
