import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    TrendingUp, CheckCircle, Clock, AlertTriangle,
    FileText, Receipt, Euro, Percent, Building2, Calculator,
    ChevronUp, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/hooks/useCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService, DashboardStats } from '@/services/api';
import { useSubscription } from '@/hooks/useSubscription';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const chartPrimaryColor = 'hsl(var(--primary))';

const monthNames: Record<string, string> = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aoû',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

export function Dashboard() {
    const { currentCompany } = useCompany();
    const { isRootSuperadmin } = useAuth();
    const { needsSubscription, refresh: refreshSubscription } = useSubscription();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [selectedYear] = useState(new Date().getFullYear());
    const [searchParams, setSearchParams] = useSearchParams();
    const pollingRef = useRef<ReturnType<typeof setInterval>>();

    // Polling après retour de Stripe Checkout
    const justSubscribed = searchParams.get('subscription') === 'success';

    const cleanupPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
        }
    }, []);

    useEffect(() => {
        if (!justSubscribed) return;

        // Webhook peut prendre 1-5s, on poll toutes les 2s pendant max 30s
        let attempts = 0;
        const maxAttempts = 15;

        pollingRef.current = setInterval(async () => {
            attempts++;
            await refreshSubscription();

            if (!needsSubscription || attempts >= maxAttempts) {
                cleanupPolling();
                // Retirer le query param de l'URL
                searchParams.delete('subscription');
                searchParams.delete('session_id');
                setSearchParams(searchParams, { replace: true });
            }
        }, 2000);

        return cleanupPolling;
    }, [justSubscribed]);

    useEffect(() => {
        const loadData = async () => {
            if (!currentCompany) {
                setStats(null);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await dashboardService.getStats(currentCompany.id, selectedYear);
                setStats(data);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentCompany?.id, selectedYear]);

    if (loading) {
        return (
            <div className="mx-auto max-w-7xl space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-10 w-80" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    if (!currentCompany) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Tableau de bord</h1>
                    <p className="text-muted-foreground">
                        {isRootSuperadmin
                            ? "Accedez a l'espace documentaire global sans selection d'entreprise."
                            : "Configurez votre espace en créant votre première entreprise."}
                    </p>
                </div>

                <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle>Bienvenue</CardTitle>
                        <CardDescription>
                            {isRootSuperadmin
                                ? "Votre compte root superadmin dispose d'un espace global dedie pour consulter les devis, factures et avoirs de toutes les entreprises."
                                : "Aucune entreprise courante n'est sélectionnée. Vous pouvez tout de même gérer votre abonnement et créer votre propre structure."}
                        </CardDescription>
                    </CardHeader>
                    {isRootSuperadmin && (
                        <CardContent>
                            <a
                                href="/superadmin"
                                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                            >
                                Ouvrir l'espace Superadmin
                            </a>
                        </CardContent>
                    )}
                </Card>
            </div>
        );
    }

    if (!stats) return null;

    const chartData = stats.company.monthly_revenue.map((item) => ({
        month: monthNames[item.month.split('-')[1]] || item.month,
        amount: item.amount,
    }));

    // Shared content blocks
    const companyTabContent = (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <TrendingUp className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-muted-foreground">CA TTC</p>
                                    <div className="flex items-center gap-1 text-xs">
                                        {stats.company.revenue_vs_previous >= 0 ? (
                                            <ChevronUp className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3 text-red-500" />
                                        )}
                                        <span className={stats.company.revenue_vs_previous >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatPercent(stats.company.revenue_vs_previous)}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold mt-1">
                                    {formatCurrency(stats.company.total_revenue)}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <CheckCircle className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-muted-foreground">Encaissé</p>
                                <div className="text-2xl font-bold text-green-600 mt-1">
                                    {formatCurrency(stats.company.total_paid)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.company.total_revenue > 0
                                        ? Math.round((stats.company.total_paid / stats.company.total_revenue) * 100)
                                        : 0}% du CA
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Clock className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-muted-foreground">En attente</p>
                                <div className="text-2xl font-bold text-blue-600 mt-1">
                                    {formatCurrency(stats.company.total_pending)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Paiements à recevoir
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <AlertTriangle className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-muted-foreground">En retard</p>
                                <div className="text-2xl font-bold text-red-600 mt-1">
                                    {formatCurrency(stats.company.total_overdue)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    À relancer
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Évolution du CA</CardTitle>
                        <CardDescription>Chiffre d'affaires mensuel</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                                    <YAxis
                                        stroke="#9ca3af"
                                        fontSize={12}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        formatter={(value) => {
                                            const amount = typeof value === 'number' ? value : Number(value);
                                            return Number.isFinite(amount)
                                                ? [formatCurrency(amount), 'CA']
                                                : ['', 'CA'];
                                        }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="amount"
                                        stroke={chartPrimaryColor}
                                        strokeWidth={2}
                                        dot={{ fill: chartPrimaryColor, strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Pipeline commercial</CardTitle>
                        <CardDescription>Devis en cours</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold">{stats.company.quotes_sent}</div>
                                <div className="text-xs text-muted-foreground">Envoyés</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">{stats.company.quotes_accepted}</div>
                                <div className="text-xs text-muted-foreground">Acceptés</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.company.conversion_rate}%</div>
                                <div className="text-xs text-muted-foreground">Taux</div>
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Montant en cours</span>
                                <span className="font-semibold">{formatCurrency(stats.company.pending_quotes_amount)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Factures émises</span>
                            <span className="font-semibold">{stats.company.invoice_count}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Panier moyen</span>
                            <span className="font-semibold">{formatCurrency(stats.company.average_invoice)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {stats.company.top_overdue_clients.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Clients en retard
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.company.top_overdue_clients.map((client, index) => (
                                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <div>
                                        <div className="font-medium">{client.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {client.days} jours de retard
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-red-600">
                                            {formatCurrency(client.amount)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    const accountingTabContent = (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">TVA collectée</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.accounting.total_vat)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {stats.accounting.vat_by_rate.map((v) => `${v.rate}%: ${formatCurrency(v.amount)}`).join(' | ')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Factures émises</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.accounting.invoices_sent}</div>
                        <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                                {stats.accounting.invoices_draft} brouillons
                            </Badge>
                            <Badge variant="default" className="text-xs">
                                {stats.accounting.invoices_paid} payées
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avoirs émis</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.accounting.credit_notes_count}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(stats.company.credit_notes_amount)} au total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">TVA sur avoirs</CardTitle>
                        <Euro className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            -{formatCurrency(stats.accounting.vat_on_credit_notes)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            TVA à déduire
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Répartition TVA par taux</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {stats.accounting.vat_by_rate.map((vat) => (
                            <div key={vat.rate} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{vat.rate}%</Badge>
                                    <span className="text-sm">TVA collectée</span>
                                </div>
                                <span className="font-semibold">{formatCurrency(vat.amount)}</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t font-semibold">
                            <span>Total TVA nette</span>
                            <span>{formatCurrency(stats.accounting.total_vat - stats.accounting.vat_on_credit_notes)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Statut des factures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                <span className="text-sm">Brouillons</span>
                                <span className="ml-auto font-semibold">{stats.accounting.invoices_draft}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-sm">Envoyées</span>
                                <span className="ml-auto font-semibold">{stats.accounting.invoices_sent}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-sm">Payées</span>
                                <span className="ml-auto font-semibold">{stats.accounting.invoices_paid}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-sm">En retard</span>
                                <span className="ml-auto font-semibold">{stats.accounting.invoices_overdue}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Exonérations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-muted-foreground">Factures sans TVA</span>
                                <span className="font-semibold">{stats.accounting.invoices_without_vat}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-muted-foreground">Avoirs émis</span>
                                <span className="font-semibold">{stats.accounting.credit_notes_count}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Tableau de bord</h1>
                    <p className="text-muted-foreground">
                        {permissions.isAccountantSide
                            ? `Vue globale de votre cabinet - ${selectedYear}`
                            : `Vue d'ensemble de votre activité - ${selectedYear}`}
                    </p>
                </div>
                <Badge variant="secondary" className="text-sm">
                    {selectedYear}
                </Badge>
            </div>

            {/* accountant / accountant_consultant: only the Comptable view, no tab selector */}
            {permissions.isAccountantSide && accountingTabContent}

            {/* merchant_consultant: only the Entreprise view, no tab selector */}
            {permissions.isMerchantConsultant && companyTabContent}

            {/* superadmin: read-only Entreprise view */}
            {permissions.isSuperAdmin && companyTabContent}

            {/* merchant_admin: both tabs */}
            {permissions.isMerchantAdmin && (
                <Tabs defaultValue="company" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="company" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Entreprise
                        </TabsTrigger>
                        <TabsTrigger value="accounting" className="flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Comptabilité
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="company">{companyTabContent}</TabsContent>
                    <TabsContent value="accounting">{accountingTabContent}</TabsContent>
                </Tabs>
            )}
        </div>
    );
}
