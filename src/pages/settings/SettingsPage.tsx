import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, CreditCard, Bell, Shield, Save, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { userService, subscriptionService, type UserProfile, type SubscriptionPlan } from '@/services/api';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaymentForm } from '@/components/PaymentForm';

/**
 * Page des paramètres avec onglets
 */
export function SettingsPage() {
    const formatPrice = (price: number) => price.toFixed(2).replace('.', ',');
    const { user } = useAuth();
    const { currentCompany } = useCompany();
    const { toast } = useToast();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const {
        subscription,
        usage,
        billingPeriod: currentBillingPeriod,
        isSuspended,
        needsSubscription,
        canManageBilling,
        scope,
        refresh: refreshSubscription,
    } = useSubscription();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval>>();

    // Polling après retour de Stripe Checkout
    const justSubscribed = searchParams.get('subscription') === 'success';
    const justChangedSubscription = searchParams.get('subscription_change') === 'success';

    const cleanupPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
        }
    }, []);

    useEffect(() => {
        if (!justSubscribed && !justChangedSubscription) return;

        let attempts = 0;
        const maxAttempts = 15;

        pollingRef.current = setInterval(async () => {
            attempts++;
            await refreshSubscription();
            await loadData();

            const shouldStopPolling = justChangedSubscription
                ? attempts >= maxAttempts
                : !needsSubscription || attempts >= maxAttempts;

            if (shouldStopPolling) {
                cleanupPolling();
                searchParams.delete('subscription');
                searchParams.delete('subscription_change');
                searchParams.delete('session_id');
                searchParams.delete('payment_intent');
                searchParams.delete('payment_intent_client_secret');
                searchParams.delete('redirect_status');
                setSearchParams(searchParams, { replace: true });
            }
        }, 2000);

        return cleanupPolling;
    }, [justSubscribed, justChangedSubscription]);

    const [, setProfile] = useState<UserProfile | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);
    const [paymentPlan, setPaymentPlan] = useState<SubscriptionPlan | null>(null);
    const [changePlanPaymentClientSecret, setChangePlanPaymentClientSecret] = useState<string | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>(currentBillingPeriod);
    const canShowSubscriptionTab = currentCompany?.role === 'merchant_admin';

    // Champs du formulaire
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        setSelectedBillingPeriod(currentBillingPeriod);
    }, [currentBillingPeriod]);

    // Charge les données au montage et quand l'entreprise sélectionnée change
    useEffect(() => {
        loadData();
    }, [currentCompany?.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [profileData, subscriptionData] = await Promise.all([
                userService.getProfile(),
                subscriptionService.getSubscriptionWithPlans(currentCompany?.id),
            ]);

            setProfile(profileData);
            setPlans(subscriptionData.available_plans);

            // Initialise les champs
            setFirstName(profileData.first_name || '');
            setLastName(profileData.last_name || '');
            setPhone(profileData.phone || '');
            setAddress(profileData.address || '');
        } catch (error: any) {
            console.error('Erreur chargement:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les données.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            const updated = await userService.updateProfile({
                first_name: firstName,
                last_name: lastName,
                phone,
                address,
            });
            setProfile(updated);
            toast({
                title: 'Profil mis à jour',
                description: 'Vos informations ont été sauvegardées.',
            });
        } catch (error: any) {
            console.error('Erreur sauvegarde:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de sauvegarder le profil.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const executeChangePlan = async (plan: SubscriptionPlan) => {
        try {
            if (!canManageBilling) {
                toast({
                    title: 'Facturation gérée par un administrateur',
                    description: "Vous ne pouvez pas modifier l'abonnement de cette entreprise.",
                });
                return;
            }

            setSaving(true);

            const result = await subscriptionService.changePlan(
                plan.slug,
                selectedBillingPeriod,
                currentCompany?.id,
            );

            if (result.client_secret) {
                setPaymentPlan(plan);
                setChangePlanPaymentClientSecret(result.client_secret);
                toast({
                    title: 'Paiement à confirmer',
                    description: 'Confirmez le paiement pour appliquer le changement de plan.',
                });
                return;
            }

            if (result.status === 'pending') {
                await refreshSubscription();
                toast({
                    title: 'Paiement en cours',
                    description: 'Le changement de plan sera appliqué dès confirmation du paiement.',
                });
                return;
            }

            await loadData();
            await refreshSubscription();
            toast({
                title: 'Plan modifié',
                description: 'Votre abonnement a été mis à jour.',
            });
        } catch (error: any) {
            console.error('Erreur changement plan:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de changer de plan.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePlanPaymentSuccess = async () => {
        setChangePlanPaymentClientSecret(null);
        setPaymentPlan(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('subscription_change', 'success');
        setSearchParams(nextParams, { replace: true });
        await loadData();
        await refreshSubscription();
        toast({
            title: 'Paiement confirmé',
            description: 'Votre changement de plan est en cours d’application.',
        });
    };

    const handleChangePlan = async (plan: SubscriptionPlan) => {
        const currentPrice = selectedBillingPeriod === 'yearly'
            ? (subscription?.plan?.price_yearly ?? 0)
            : (subscription?.plan?.price_monthly ?? 0);
        const newPrice = selectedBillingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;

        // Downgrade : demander confirmation
        if (newPrice < currentPrice) {
            setPendingPlan(plan);
            setConfirmDialogOpen(true);
            return;
        }

        // Upgrade ou même niveau : procéder directement
        await executeChangePlan(plan);
    };

    const handleConfirmChangePlan = async () => {
        setConfirmDialogOpen(false);
        if (pendingPlan) {
            await executeChangePlan(pendingPlan);
            setPendingPlan(null);
        }
    };

    const currentPlanSlug = subscription?.plan?.slug;
    const canOpenLegalDocuments = Boolean(currentCompany?.id && permissions.canManageCompanySettings);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Paramètres</h1>
                    <p className="text-muted-foreground">Gérez votre compte et vos préférences</p>
                </div>
                <div className="space-y-2 text-right">
                    {canOpenLegalDocuments ? (
                        <Button asChild variant="outline">
                            <Link to="/settings/legal-documents">
                                <Shield className="mr-2 h-4 w-4" />
                                Documents légaux de l’entreprise
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" disabled>
                            <Shield className="mr-2 h-4 w-4" />
                            Documents légaux de l’entreprise
                        </Button>
                    )}
                    <p className="text-sm text-muted-foreground">
                        {currentCompany?.name
                            ? `Entreprise sélectionnée : ${currentCompany.name}`
                            : 'Sélectionnez une entreprise pour accéder à ses documents légaux.'}
                    </p>
                </div>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className={`grid w-full max-w-md ${canShowSubscriptionTab ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Profil</span>
                    </TabsTrigger>
                    {canShowSubscriptionTab && (
                        <TabsTrigger value="subscription" className="gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span className="hidden sm:inline">Abonnement</span>
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="h-4 w-4" />
                        <span className="hidden sm:inline">Notifications</span>
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="hidden sm:inline">Sécurité</span>
                    </TabsTrigger>
                </TabsList>

                {/* Onglet Profil */}
                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations personnelles</CardTitle>
                            <CardDescription>
                                Gérez vos informations de profil
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                                    <AvatarFallback className="text-lg">
                                        {firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{firstName} {lastName}</p>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                            </div>

                            <Separator />

                            {/* Formulaire */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Prénom</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Votre prénom"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Nom</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Téléphone</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+33 6 12 34 56 78"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="address">Adresse</Label>
                                    <Input
                                        id="address"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Votre adresse complète"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSaveProfile} disabled={saving}>
                                    {saving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Enregistrer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {canShowSubscriptionTab && (
                    <TabsContent value="subscription" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Votre abonnement</CardTitle>
                                <CardDescription>
                                    {canManageBilling
                                        ? 'Gérez votre plan et votre facturation'
                                        : "Consultez l'état de l'abonnement géré par l'administrateur"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 rounded-lg border bg-muted/50 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">
                                                Plan actuel : {subscription?.plan?.name || 'Aucun'}
                                                {subscription?.billing_period && (
                                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                        ({subscription.billing_period === 'yearly' ? 'Annuel' : 'Mensuel'})
                                                    </span>
                                                )}
                                            </p>
                                            {usage && (
                                                <>
                                                    <p className="text-sm text-muted-foreground">
                                                        Factures ce mois : {usage.invoices_this_month}
                                                        {subscription?.plan?.max_invoices_per_month
                                                            ? ` / ${subscription.plan.max_invoices_per_month}`
                                                            : ' (illimitées)'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Devis ce mois : {usage.quotes_this_month}
                                                        {subscription?.plan?.max_quotes_per_month
                                                            ? ` / ${subscription.plan.max_quotes_per_month}`
                                                            : ' (illimités)'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Membres : {usage.total_members}
                                                        {usage.extra_members > 0
                                                            ? ` (dont ${usage.extra_members} supplémentaire${usage.extra_members > 1 ? 's' : ''} à 1,50 € HT/mois)`
                                                            : ' (propriétaire inclus)'}
                                                    </p>
                                                    {usage.pending_invitations > 0 && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Invitations en attente facturables : {usage.pending_invitations}
                                                        </p>
                                                    )}
                                                    <p className="text-sm text-muted-foreground">
                                                        Places facturables : {usage.billable_members}
                                                        {usage.billable_extra_members > 0
                                                            ? ` (dont ${usage.billable_extra_members} add-on${usage.billable_extra_members > 1 ? 's' : ''} à 1,50 € HT/mois)`
                                                            : ' (aucun add-on facturable)'}
                                                    </p>
                                                </>
                                            )}
                                            {subscription?.current_period_end && (
                                                <p className="text-sm text-muted-foreground">
                                                    Fin de période : {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
                                                </p>
                                            )}
                                            {!canManageBilling && (
                                                <p className="text-sm text-muted-foreground">
                                                    {scope === 'owner'
                                                        ? "Cet abonnement est porté par le propriétaire de l'entreprise."
                                                        : "Vous n'avez pas la gestion directe de la facturation."}
                                                </p>
                                            )}
                                        </div>
                                        <Badge
                                            variant={
                                                isSuspended || needsSubscription ? 'destructive' :
                                                (subscription?.status || 'active') === 'active' ? 'default' : 'secondary'
                                            }
                                        >
                                            {subscription?.status === 'past_due' ? 'Impayé' :
                                             subscription?.status === 'cancelled' ? 'Annulé' :
                                             subscription?.status === 'incomplete' || !subscription?.plan_id ? 'Inactif' :
                                             'Actif'}
                                        </Badge>
                                    </div>
                                </div>

                                {canManageBilling ? (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="font-medium">Plans disponibles</h3>
                                            <div className="inline-flex items-center rounded-lg border bg-muted p-1">
                                                <button
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                                        selectedBillingPeriod === 'monthly'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                    onClick={() => setSelectedBillingPeriod('monthly')}
                                                >
                                                    Mensuel
                                                </button>
                                                <button
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                                        selectedBillingPeriod === 'yearly'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                    onClick={() => setSelectedBillingPeriod('yearly')}
                                                >
                                                    Annuel
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-3">
                                            {plans.map((plan) => {
                                                const isCurrentPlan = currentPlanSlug === plan.slug && selectedBillingPeriod === currentBillingPeriod;
                                                const price = selectedBillingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
                                                const periodLabel = selectedBillingPeriod === 'yearly' ? 'HT/an' : 'HT/mois';
                                                return (
                                                <Card
                                                    key={plan.id}
                                                    className={`relative ${isCurrentPlan ? 'border-primary' : ''}`}
                                                >
                                                    {isCurrentPlan && (
                                                        <div className="absolute -top-2 left-4 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                                            Actuel
                                                        </div>
                                                    )}
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                                                        <div className="text-2xl font-bold">
                                                            {formatPrice(price)}€
                                                            <span className="text-sm font-normal text-muted-foreground">
                                                                {' '}{periodLabel}
                                                            </span>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        <ul className="space-y-1 text-sm">
                                                            <li className="flex items-center gap-2">
                                                                <Check className="h-4 w-4 text-primary" />
                                                                {plan.max_invoices_per_month ?? '∞'} factures/mois
                                                            </li>
                                                            <li className="flex items-center gap-2">
                                                                <Check className="h-4 w-4 text-primary" />
                                                                {plan.max_quotes_per_month ?? '∞'} devis/mois
                                                            </li>
                                                            <li className="flex items-center gap-2">
                                                                <Check className="h-4 w-4 text-primary" />
                                                                Avoirs illimités
                                                            </li>
                                                            <li className="flex items-center gap-2">
                                                                <Check className="h-4 w-4 text-primary" />
                                                                Sociétés illimitées
                                                            </li>
                                                            <li className="flex items-center gap-2">
                                                                <Check className="h-4 w-4 text-primary" />
                                                                Membres illimités
                                                            </li>
                                                        </ul>
                                                        <p className="text-xs text-muted-foreground">
                                                            + {formatPrice(plan.price_per_additional_member)} € HT / membre suppl. / mois
                                                        </p>
                                                        {!isCurrentPlan && (
                                                            <Button
                                                                className="mt-4 w-full"
                                                                onClick={() => handleChangePlan(plan)}
                                                                disabled={saving}
                                                            >
                                                                {saving ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    'Choisir ce plan'
                                                                )}
                                                            </Button>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                        L’abonnement et la facturation sont gérés par l’administrateur de l’entreprise. Les changements de plan ne sont pas disponibles depuis ce compte.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Onglet Notifications */}
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle>Préférences de notifications</CardTitle>
                            <CardDescription>
                                Configurez comment vous souhaitez être notifié
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Les paramètres de notifications seront disponibles prochainement.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Onglet Sécurité */}
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sécurité du compte</CardTitle>
                            <CardDescription>
                                Gérez la sécurité de votre compte
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Connexion Google</p>
                                        <p className="text-sm text-muted-foreground">
                                            Connecté via {user?.email}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                                        Actif
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <ConfirmationDialog
                open={confirmDialogOpen}
                onConfirm={handleConfirmChangePlan}
                onCancel={() => { setConfirmDialogOpen(false); setPendingPlan(null); }}
                title="Confirmer le changement de plan"
                description={
                    pendingPlan
                        ? `Vous êtes sur le point de passer au plan "${pendingPlan.name}" (${formatPrice(pendingPlan.price_monthly)}€ HT/mois). Votre facturation sera ajustée au prorata. Voulez-vous continuer ?`
                        : ''
                }
                confirmLabel="Changer de plan"
                cancelLabel="Annuler"
                variant="destructive"
            />
            <Dialog
                open={Boolean(changePlanPaymentClientSecret)}
                onOpenChange={(open) => {
                    if (!open) {
                        setChangePlanPaymentClientSecret(null);
                        setPaymentPlan(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmer le paiement</DialogTitle>
                        <DialogDescription>
                            {paymentPlan
                                ? `Confirmez le paiement pour appliquer le plan ${paymentPlan.name}.`
                                : 'Confirmez le paiement pour appliquer le changement de plan.'}
                        </DialogDescription>
                    </DialogHeader>
                    {changePlanPaymentClientSecret && (
                        <PaymentForm
                            clientSecret={changePlanPaymentClientSecret}
                            onSuccess={() => {
                                void handleChangePlanPaymentSuccess();
                            }}
                            returnUrl={`${window.location.origin}/settings?subscription_change=success`}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
