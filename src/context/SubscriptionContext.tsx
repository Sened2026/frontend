import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { subscriptionService, type SubscriptionWithPlans, type SubscriptionPlan } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';

interface SubscriptionContextType {
    subscription: SubscriptionWithPlans['subscription'];
    usage: SubscriptionWithPlans['usage'] | null;
    billingPeriod: 'monthly' | 'yearly';
    isSuspended: boolean;
    isReadOnly: boolean;
    needsSubscription: boolean;
    canAccessApp: boolean;
    canManageBilling: boolean;
    scope: SubscriptionWithPlans['scope'];
    ownerUserId: string | null;
    companyId: string | null;
    hasAnyActiveCompanySubscription: boolean;
    isInvitedMerchantAdmin: boolean;
    planLimits: SubscriptionPlan | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: null,
    usage: null,
    billingPeriod: 'monthly',
    isSuspended: false,
    isReadOnly: false,
    needsSubscription: false,
    canAccessApp: false,
    canManageBilling: false,
    scope: 'none',
    ownerUserId: null,
    companyId: null,
    hasAnyActiveCompanySubscription: false,
    isInvitedMerchantAdmin: false,
    planLimits: null,
    loading: true,
    refresh: async () => {},
});

const SUSPENDED_STATUSES = ['past_due', 'incomplete', 'cancelled'];

function hasUsableSubscriptionForCompanyOwnerRole(
    subscription: SubscriptionWithPlans['subscription'],
    companyOwnerRole: SubscriptionWithPlans['company_owner_role'],
    isSuspended: boolean,
    _isCompanyLinkedToAccountantCabinet: boolean,
): boolean {
    if (companyOwnerRole === 'accountant') {
        return true;
    }

    if (!subscription?.plan_id || isSuspended) {
        return false;
    }

    if (companyOwnerRole === 'merchant_admin' && subscription.plan?.slug === 'free') {
        return false;
    }

    return true;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { operationalCompany, hasResolved: companyResolved } = useOperationalCompany();
    const userId = user?.id ?? null;
    const currentCompanyId = operationalCompany?.id ?? null;
    const [subscription, setSubscription] = useState<SubscriptionWithPlans['subscription']>(null);
    const [usage, setUsage] = useState<SubscriptionWithPlans['usage'] | null>(null);
    const [planLimits, setPlanLimits] = useState<SubscriptionPlan | null>(null);
    const [scope, setScope] = useState<SubscriptionWithPlans['scope']>('none');
    const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [companyOwnerRole, setCompanyOwnerRole] = useState<SubscriptionWithPlans['company_owner_role']>(null);
    const [isCompanyLinkedToAccountantCabinet, setIsCompanyLinkedToAccountantCabinet] = useState(false);
    const [canManageBilling, setCanManageBilling] = useState(false);
    const [hasAnyActiveCompanySubscription, setHasAnyActiveCompanySubscription] = useState(false);
    const [isInvitedMerchantAdmin, setIsInvitedMerchantAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<Error | null>(null);
    const requestIdRef = useRef(0);

    const refresh = useCallback(async () => {
        if (!userId) {
            requestIdRef.current += 1;
            setSubscription(null);
            setUsage(null);
            setPlanLimits(null);
            setScope('none');
            setOwnerUserId(null);
            setCompanyId(null);
            setCompanyOwnerRole(null);
            setIsCompanyLinkedToAccountantCabinet(false);
            setCanManageBilling(false);
            setHasAnyActiveCompanySubscription(false);
            setIsInvitedMerchantAdmin(false);
            setLoadError(null);
            setLoading(false);
            return;
        }

        if (!companyResolved) {
            setLoading(true);
            return;
        }

        const requestId = ++requestIdRef.current;

        try {
            setLoading(true);
            setLoadError(null);
            const data = await subscriptionService.getSubscriptionWithPlans(currentCompanyId || undefined);
            if (requestId !== requestIdRef.current) {
                return;
            }
            setSubscription(data.subscription);
            setUsage(data.usage);
            setPlanLimits(data.subscription?.plan || null);
            setScope(data.scope);
            setOwnerUserId(data.owner_user_id);
            setCompanyId(data.company_id);
            setCompanyOwnerRole(data.company_owner_role);
            setIsCompanyLinkedToAccountantCabinet(data.is_company_linked_to_accountant_cabinet ?? false);
            setCanManageBilling(data.can_manage_billing);
            setHasAnyActiveCompanySubscription(data.has_any_active_company_subscription);
            setIsInvitedMerchantAdmin(Boolean(data.is_invited_merchant_admin));
        } catch (error) {
            if (requestId !== requestIdRef.current) {
                return;
            }
            setLoadError(error instanceof Error ? error : new Error('Erreur lors du chargement de l’abonnement'));
            console.error('Erreur chargement abonnement:', error);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [userId, currentCompanyId, companyResolved]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const isSuspended = subscription
        ? SUSPENDED_STATUSES.includes(subscription.status)
        : false;

    const billingPeriod = (subscription?.billing_period === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
    const hasEffectiveSubscription = hasUsableSubscriptionForCompanyOwnerRole(
        subscription,
        companyOwnerRole,
        isSuspended,
        isCompanyLinkedToAccountantCabinet,
    );
    const canAccessApp = loading || loadError
        ? true
        : hasEffectiveSubscription
            || (!currentCompanyId && hasAnyActiveCompanySubscription)
            || (!canManageBilling && (hasAnyActiveCompanySubscription || isInvitedMerchantAdmin));
    const needsSubscription = !loading
        && !loadError
        && Boolean(currentCompanyId)
        && canManageBilling
        && !hasEffectiveSubscription;
    const isReadOnly = !loading
        && !loadError
        && Boolean(currentCompanyId)
        && !hasEffectiveSubscription;

    return (
        <SubscriptionContext.Provider
            value={{
                subscription,
                usage,
                billingPeriod,
                isSuspended,
                isReadOnly,
                needsSubscription,
                canAccessApp,
                canManageBilling,
                scope,
                ownerUserId,
                companyId,
                hasAnyActiveCompanySubscription,
                isInvitedMerchantAdmin,
                planLimits,
                loading,
                refresh,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    return useContext(SubscriptionContext);
}
