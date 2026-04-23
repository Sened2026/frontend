import { useState, Suspense, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
    LogOut,
    FileText,
    Settings,
    Menu,
    Package,
    Users,
    Receipt,
    HelpCircle,
    ChevronDown,
    FileMinus,
    LayoutDashboard,
    Briefcase,
    AlertTriangle,
    Building2,
    Crown,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { useOperationalCompany } from "@/hooks/useOperationalCompany";
import { usePermissions } from "@/hooks/usePermissions";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { subscriptionService } from "@/services/api";
import { cn } from "@/lib/utils";

function shouldShowSubscriptionBanner(pathname: string, isReadOnly: boolean): boolean {
    if (!isReadOnly) {
        return false;
    }

    const readOnlyPages = [
        "/accountant",
        "/settings",
        "/support",
    ];

    if (readOnlyPages.some((path) => pathname.startsWith(path))) {
        return false;
    }

    const writeBlockingPages = [
        "/dashboard",
        "/quotes",
        "/invoices",
        "/credit-notes",
        "/clients",
        "/products",
        "/companies",
    ];

    return writeBlockingPages.some((path) => pathname.startsWith(path));
}

/**
 * Sélecteur d'entreprise compact pour le header
 */
function CompanySelectorHeader() {
    const { companies, currentCompany, setCurrentCompany } = useCompany();
    const location = useLocation();

    if (companies.length === 0) {
        return null;
    }

    const isOnRestrictedPage =
        location.pathname.includes("/new") ||
        location.pathname.includes("/edit") ||
        location.pathname.includes("/create") ||
        /\/(clients|quotes|invoices)\/[^/]+$/.test(location.pathname) ||
        location.pathname.includes("/payment");

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    disabled={isOnRestrictedPage}
                    title={
                        isOnRestrictedPage
                            ? "Impossible de changer d'entreprise pendant une opération"
                            : undefined
                    }
                >
                    <div className="text-left min-w-0">
                        <div className="font-medium truncate max-w-[200px]">
                            {currentCompany?.name || "Sélectionner"}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentCompany?.siren && (
                                <span className="text-xs text-muted-foreground truncate">
                                    SIREN: {currentCompany.siren}
                                </span>
                            )}
                            {currentCompany?.is_owner && (
                                <Badge
                                    variant="secondary"
                                    className="h-4 gap-0.5 px-1 text-[10px] shrink-0"
                                >
                                    <Crown className="h-2.5 w-2.5" />
                                    Propriétaire
                                </Badge>
                            )}
                        </div>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                {companies.map((company) => (
                    <DropdownMenuItem
                        key={company.id}
                        onClick={() => setCurrentCompany(company)}
                        className={cn(
                            currentCompany?.id === company.id && "bg-accent",
                        )}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                                {company.name}
                            </span>
                            <div className="flex items-center gap-2">
                                {company.siren && (
                                    <span className="text-xs text-muted-foreground truncate">
                                        SIREN: {company.siren}
                                    </span>
                                )}
                                {company.is_owner && (
                                    <Badge
                                        variant="secondary"
                                        className="h-4 gap-0.5 px-1 text-[10px] shrink-0"
                                    >
                                        <Crown className="h-2.5 w-2.5" />
                                        Propriétaire
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Layout principal de l'application avec sidebar persistante
 */
function AppLayoutContent() {
    const { user, signOut, loading: authLoading, isRootSuperadmin } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const {
        companies,
        currentCompany,
        setCurrentCompany,
        loading: companiesLoading,
        hasResolved: companiesResolved,
        loadError: companiesLoadError,
    } = useCompany();
    const {
        cabinetCompany,
        operationalCompany,
        shouldPromoteCabinetSelection,
    } = useOperationalCompany();
    const {
        needsSubscription,
        isReadOnly,
        canManageBilling,
        subscription,
        loading: subscriptionLoading,
        refresh: refreshSubscription,
    } =
        useSubscription();
    const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);
    const hasAnyCompany = companies.length > 0;
    const subscriptionCompanyName =
        operationalCompany?.name || currentCompany?.name || "cette entreprise";
    const hasStripeSubscription = Boolean(subscription?.stripe_subscription_id);
    const showSubscriptionBanner =
        companiesResolved &&
        !companiesLoading &&
        !subscriptionLoading &&
        shouldShowSubscriptionBanner(location.pathname, isReadOnly);

    const handleRefreshSubscription = async () => {
        try {
            setIsRefreshingSubscription(true);
            await refreshSubscription();
        } finally {
            setIsRefreshingSubscription(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            toast({
                title: "Déconnexion réussie",
                description: "À bientôt !",
            });
        } catch (error) {
            console.error("Erreur de déconnexion:", error);
            toast({
                title: "Erreur",
                description: "Impossible de se déconnecter.",
                variant: "destructive",
            });
        }
    };

    const permissions = usePermissions(
        operationalCompany?.role,
        operationalCompany?.company_owner_role,
    );

    useEffect(() => {
        if (authLoading || companiesLoading || !companiesResolved || companiesLoadError) {
            return;
        }

        if (!shouldPromoteCabinetSelection || !cabinetCompany || currentCompany?.id === cabinetCompany.id) {
            return;
        }

        setCurrentCompany(cabinetCompany);
    }, [
        authLoading,
        cabinetCompany,
        companiesLoadError,
        companiesLoading,
        companiesResolved,
        currentCompany?.id,
        setCurrentCompany,
        shouldPromoteCabinetSelection,
    ]);

    const mainNavItems = useMemo(() => {
        const items = [
            {
                path: "/dashboard",
                label: "Tableau de bord",
                icon: LayoutDashboard,
            },
            ...(isRootSuperadmin
                ? [{ path: "/superadmin", label: "Superadmin", icon: Crown }]
                : []),
            { path: "/quotes", label: "Devis", icon: FileText },
            { path: "/invoices", label: "Factures", icon: Receipt },
            { path: "/credit-notes", label: "Avoirs", icon: FileMinus },
            { path: "/clients", label: "Clients", icon: Users },
            { path: "/products", label: "Produits", icon: Package },
            { path: "/companies", label: "Mes entreprises", icon: Building2 },
        ];
        if (!hasAnyCompany) {
            return items.filter((item) =>
                ["/dashboard", "/companies", "/superadmin"].includes(item.path),
            );
        }

        const filteredItems = items.filter((item) => {
            if (item.path === "/quotes") return permissions.canViewQuotes;
            if (item.path === "/clients") return permissions.canViewClients;
            if (item.path === "/products") return permissions.canViewProducts;
            return true;
        });

        if (permissions.isAccountantSide) {
            filteredItems.splice(1, 0, {
                path: "/accountant",
                label: "Dossiers clients",
                icon: Briefcase,
            });
        }

        return filteredItems;
    }, [
        hasAnyCompany,
        isRootSuperadmin,
        permissions.canViewClients,
        permissions.canViewProducts,
        permissions.canViewQuotes,
        permissions.isAccountantSide,
    ]);

    useEffect(() => {
        if (authLoading || companiesLoading || !companiesResolved || companiesLoadError) {
            return;
        }

        const path = location.pathname;

        if (path.startsWith("/accountant") && !permissions.isAccountantSide) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path.startsWith("/superadmin") && !isRootSuperadmin) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path.startsWith("/quotes") && !permissions.canViewQuotes) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path.startsWith("/clients") && !permissions.canViewClients) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path.startsWith("/products") && !permissions.canViewProducts) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path.startsWith("/settings") && !permissions.canAccessSettings) {
            navigate("/dashboard", { replace: true });
            return;
        }

        if (path === "/quotes/new" && !permissions.canCreateQuote) {
            navigate("/quotes", { replace: true });
            return;
        }

        if (/^\/quotes\/[^/]+\/edit$/.test(path) && !permissions.canEditQuote) {
            navigate(path.replace(/\/edit$/, ""), { replace: true });
            return;
        }

        if (path === "/invoices/new" && !permissions.canCreateInvoice) {
            navigate("/invoices", { replace: true });
            return;
        }

        if (/^\/invoices\/[^/]+\/edit$/.test(path) && !permissions.canEditInvoice) {
            navigate(path.replace(/\/edit$/, ""), { replace: true });
            return;
        }

        if (/^\/invoices\/[^/]+\/payment$/.test(path) && !permissions.canEditInvoice) {
            navigate(path.replace(/\/payment$/, ""), { replace: true });
        }
    }, [
        authLoading,
        companiesLoadError,
        companiesLoading,
        companiesResolved,
        location.pathname,
        navigate,
        permissions.canAccessSettings,
        permissions.canCreateInvoice,
        permissions.canCreateQuote,
        permissions.canEditInvoice,
        permissions.canEditQuote,
        permissions.canViewClients,
        permissions.canViewProducts,
        permissions.canViewQuotes,
        permissions.isAccountantSide,
        isRootSuperadmin,
    ]);

    useEffect(() => {
        if (!permissions.isAccountantSide || !permissions.isMerchantContext) return;
        const path = location.pathname;
        const restricted =
            path.startsWith("/quotes") ||
            path.startsWith("/clients") ||
            path.startsWith("/products") ||
            path === "/invoices/new" ||
            /^\/invoices\/[^/]+\/edit$/.test(path);
        if (path.startsWith("/accountant")) return;
        if (path.startsWith("/companies")) return;
        if (path.startsWith("/settings")) return;
        if (restricted) {
            navigate("/invoices", { replace: true });
        }
    }, [permissions.isAccountantSide, permissions.isMerchantContext, location.pathname, navigate]);

    useEffect(() => {
        if (authLoading || companiesLoading || !companiesResolved || companiesLoadError || hasAnyCompany) {
            return;
        }

        const path = location.pathname;
        const isAllowedWithoutCompany =
            path === "/dashboard" ||
            path === "/settings" ||
            path === "/support" ||
            path === "/companies" ||
            path === "/companies/new" ||
            path.startsWith("/superadmin");

        if (!isAllowedWithoutCompany) {
            navigate("/dashboard", { replace: true });
        }
    }, [
        authLoading,
        companiesLoading,
        companiesResolved,
        companiesLoadError,
        hasAnyCompany,
        location.pathname,
        navigate,
    ]);

    const secondaryNavItems = useMemo(() => {
        const items: { path: string; label: string; icon: typeof Settings }[] =
            [];
        if (permissions.canAccessSettings) {
            items.push({ path: "/settings", label: "Paramètres", icon: Settings });
        }
        items.push({ path: "/support", label: "Support", icon: HelpCircle });
        return items;
    }, [permissions.canAccessSettings]);

    const isActive = (path: string) => {
        return (
            location.pathname === path ||
            location.pathname.startsWith(path + "/")
        );
    };

    const userInitial =
        user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
        user?.email?.[0]?.toUpperCase() ||
        "U";
    const userName = user?.user_metadata?.full_name || "Utilisateur";
    const roleLabels: Record<string, string> = {
        merchant_admin: "Administrateur",
        merchant_consultant: "Collaborateur",
        accountant: "Expert-comptable",
        accountant_consultant: "Collaborateur comptable",
        superadmin: "Superadmin",
    };
    const userRole = currentCompany?.role
        ? roleLabels[currentCompany.role] || "Membre"
        : isRootSuperadmin
          ? "Superadmin racine"
          : "Compte utilisateur";

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card shadow-lg transition-transform duration-300 lg:relative lg:translate-x-0 lg:flex-shrink-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                )}
            >
                <div className="flex h-full flex-col overflow-y-auto">
                    {/* Logo SENED */}
                    <Link
                        to="/dashboard"
                        className="flex h-16 items-center gap-3 border-b px-6 hover:bg-muted/50"
                    >
                        <img
                            src="/brand/secondaire/SVG/SECONDAIRE_bleu.svg"
                            alt="Sened"
                            className="h-8 w-auto"
                        />
                    </Link>

                    {/* Navigation principale — sans headers de section */}
                    <nav className="flex-1 p-4">
                        <div className="space-y-1">
                            {mainNavItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <div
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                            isActive(item.path)
                                                ? "text-primary border-l-2 border-primary bg-primary/5"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.label}
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-auto space-y-1 border-t pt-4">
                            {secondaryNavItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <div
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                            isActive(item.path)
                                                ? "text-primary border-l-2 border-primary bg-primary/5"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.label}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </nav>
                </div>
            </aside>

            {/* Overlay pour mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Main content */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                {/* Header avec sélecteur entreprise + user */}
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6 flex-shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    <div className="hidden lg:block" />

                    <div className="flex items-center gap-4">
                        {/* Sélecteur entreprise */}
                        {hasAnyCompany && (
                            <>
                                <CompanySelectorHeader />
                                <div className="h-8 w-px bg-border" />
                            </>
                        )}

                        {/* User info + logout */}
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium leading-none">
                                    {userName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {userRole}
                                </p>
                            </div>
                            {user?.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt="Avatar"
                                    className="h-9 w-9 rounded-full"
                                />
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                                    {userInitial}
                                </div>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSignOut}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Déconnexion"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Banner abonnement inactif */}
                {showSubscriptionBanner && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-destructive px-6 py-3 text-destructive-foreground flex-shrink-0">
                        <div className="flex min-w-0 items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {needsSubscription
                                        ? canManageBilling
                                            ? `L'abonnement de ${subscriptionCompanyName} est inactif.`
                                            : `L'abonnement de ${subscriptionCompanyName} est inactif. Contactez son administrateur.`
                                        : canManageBilling
                                          ? `L'abonnement de ${subscriptionCompanyName} est suspendu. Les opérations d'écriture sont désactivées.`
                                          : `L'abonnement de ${subscriptionCompanyName} est géré par son administrateur. Les opérations d'écriture sont désactivées.`}
                                </p>
                                {hasAnyCompany && (
                                    <p className="text-xs opacity-90">
                                        Vous pouvez changer d'entreprise avec le sélecteur du header.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    void handleRefreshSubscription();
                                }}
                                disabled={isRefreshingSubscription}
                            >
                                {isRefreshingSubscription ? (
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Actualiser
                            </Button>
                            {canManageBilling && needsSubscription && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate("/subscribe")}
                                >
                                    Choisir un forfait
                                </Button>
                            )}
                            {canManageBilling && hasStripeSubscription && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            const { url } =
                                                await subscriptionService.createBillingPortalSession(
                                                    operationalCompany?.id || currentCompany?.id,
                                                );
                                            window.location.href = url;
                                        } catch {
                                            navigate("/settings");
                                        }
                                    }}
                                >
                                    Gérer le paiement
                                </Button>
                            )}
                            {!canManageBilling && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate("/settings")}
                                >
                                    Voir les détails
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        }
                    >
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}

/**
 * Layout principal avec WebSocketProvider
 */
export function AppLayout() {
    return (
        <WebSocketProvider>
            <AppLayoutContent />
        </WebSocketProvider>
    );
}
