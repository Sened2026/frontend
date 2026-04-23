import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Crown,
    ExternalLink,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    Star,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { companyService, subscriptionService } from '@/services/api';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useCompany } from '@/hooks/useCompany';
import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm';
import type { CompanyWithRole, CreateCompanyData } from '@/types';
import { getRoleLabel } from '@/hooks/usePermissions';

export function CompaniesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isReadOnly, refresh: refreshSubscription } = useSubscription();
    const { currentCompany, setCurrentCompany, refreshCompanies } = useCompany();

    const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
    const [ownedTotal, setOwnedTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<CompanyWithRole | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createDialogInitialData, setCreateDialogInitialData] = useState<Partial<CreateCompanyData> | undefined>(undefined);

    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const response = await companyService.getAll();
            setCompanies(response.companies);
            setOwnedTotal(response.owned_total);
        } catch {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de charger les entreprises.',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useWebSocketEvent('company:created', loadCompanies);
    useWebSocketEvent('company:updated', loadCompanies);
    useWebSocketEvent('company:deleted', loadCompanies);

    const filteredCompanies = companies.filter((company) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            company.name.toLowerCase().includes(searchLower) ||
            company.legal_name?.toLowerCase().includes(searchLower) ||
            company.siren?.includes(searchQuery) ||
            company.email?.toLowerCase().includes(searchLower)
        );
    });

    const handleCreateCompany = async (data: CreateCompanyData) => {
        if (!data.name?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Le nom de l\'entreprise est obligatoire.',
            });
            return;
        }

        try {
            setIsSubmitting(true);

            if (data.owner_role === 'merchant_admin') {
                const pendingSession =
                    await subscriptionService.createPendingCompanySubscription({
                        company_data: {
                            ...data,
                            owner_role: 'merchant_admin',
                        },
                    });

                handleCreateDialogOpenChange(false);
                toast({
                    title: 'Paiement requis',
                    description: 'Finalisez le paiement pour créer cette entreprise.',
                });
                navigate(
                    `/subscribe?pending_company_session=${pendingSession.session_id}`,
                );
                return;
            }

            const company = await companyService.create(data);
            setCurrentCompany(company);
            await Promise.all([loadCompanies(), refreshCompanies(), refreshSubscription()]);
            handleCreateDialogOpenChange(false);
            toast({
                title: 'Entreprise créée',
                description: `${company.name} est maintenant votre entreprise active.`,
            });
            if (data.source_accountant_company_id && company.role === 'merchant_admin') {
                navigate('/subscribe');
                return;
            }

            navigate('/dashboard');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de créer l\'entreprise.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSetDefault = async (company: CompanyWithRole) => {
        try {
            const updated = await companyService.setDefault(company.id);
            setCurrentCompany(updated);
            await Promise.all([loadCompanies(), refreshCompanies()]);
            toast({
                title: 'Succès',
                description: `${company.name} est maintenant votre entreprise par défaut.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de définir l\'entreprise par défaut.',
            });
        }
    };

    const handleDeleteCompany = async () => {
        if (!companyToDelete) return;

        try {
            setIsSubmitting(true);
            await companyService.delete(companyToDelete.id);
            await Promise.all([loadCompanies(), refreshCompanies(), refreshSubscription()]);
            setIsDeleteDialogOpen(false);
            setCompanyToDelete(null);
            toast({
                title: 'Succès',
                description: 'Entreprise supprimée avec succès.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer l\'entreprise.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDeleteDialog = (company: CompanyWithRole) => {
        setCompanyToDelete(company);
        setIsDeleteDialogOpen(true);
    };

    const buildMerchantCreationInitialData = (company: CompanyWithRole): Partial<CreateCompanyData> => ({
        owner_role: 'merchant_admin',
        source_accountant_company_id: company.id,
    });

    const createDisabled = isReadOnly;
    const createDisabledReason = isReadOnly
        ? 'Abonnement requis'
        : undefined;
    const canCreateMerchantFromAccountant = currentCompany?.role === 'accountant' && currentCompany.is_owner;
    const handleCreateDialogOpenChange = (open: boolean) => {
        setIsCreateDialogOpen(open);

        if (open) {
            if (canCreateMerchantFromAccountant && currentCompany) {
                setCreateDialogInitialData(buildMerchantCreationInitialData(currentCompany));
                return;
            }

            setCreateDialogInitialData(undefined);
            return;
        }

        setCreateDialogInitialData(undefined);
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Entreprises</h1>
                    <p className="text-muted-foreground">
                        {companies.length > 0
                            ? `${companies.length} accès, ${ownedTotal} entreprise(s) possédée(s).`
                            : 'Créez votre première entreprise ou gérez les accès existants.'}
                    </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                    <DialogTrigger asChild>
                        <Button disabled={createDisabled} title={createDisabledReason}>
                            <Plus className="mr-2 h-4 w-4" />
                            {canCreateMerchantFromAccountant
                                ? 'Créer une entreprise marchande'
                                : 'Nouvelle entreprise'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
                        <DialogHeader className="border-b px-6 py-4">
                            <DialogTitle>
                                {canCreateMerchantFromAccountant
                                    ? 'Créer une entreprise marchande'
                                    : 'Créer une entreprise'}
                            </DialogTitle>
                            <DialogDescription>
                                {canCreateMerchantFromAccountant
                                    ? 'La nouvelle société marchande sera liée automatiquement à votre cabinet.'
                                    : 'Choisissez le type de société puis complétez les informations principales.'}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="px-6 py-4">
                            <CompanyCreateForm
                                formId="company-create-dialog-form"
                                hideActions
                                isSubmitting={isSubmitting}
                                initialData={createDialogInitialData}
                                lockedOwnerRole={canCreateMerchantFromAccountant ? 'merchant_admin' : undefined}
                                onCancel={() => handleCreateDialogOpenChange(false)}
                                onSubmit={handleCreateCompany}
                            />
                        </DialogBody>
                        <DialogFooter className="border-t px-6 py-4">
                            <Button type="button" variant="outline" onClick={() => handleCreateDialogOpenChange(false)} disabled={isSubmitting}>
                                Annuler
                            </Button>
                            <Button type="submit" form="company-create-dialog-form" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Créer l'entreprise
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Sociétés illimitées — pas de quota */}

            {companies.length > 0 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une entreprise..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="pl-10"
                    />
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Vos entreprises</CardTitle>
                    <CardDescription>
                        {companies.length > 0
                            ? 'Votre rôle et votre propriété sont affichés séparément pour chaque société.'
                            : 'Aucune entreprise accessible pour le moment.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mb-2 text-lg font-medium">
                                {searchQuery ? 'Aucun résultat' : 'Aucune entreprise'}
                            </h3>
                            <p className="mb-4 text-muted-foreground">
                                {searchQuery
                                    ? 'Aucune entreprise ne correspond à votre recherche.'
                                    : 'Ajoutez votre première entreprise pour commencer.'}
                            </p>
                            {!searchQuery && (
                                <Button
                                    onClick={() => setIsCreateDialogOpen(true)}
                                    disabled={createDisabled}
                                    title={createDisabledReason}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ajouter une entreprise
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {filteredCompanies.map((company) => (
                                <Card
                                    key={company.id}
                                    className="cursor-pointer transition-shadow hover:shadow-md"
                                    onClick={() => navigate(`/companies/${company.id}`)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                    {company.logo_url ? (
                                                        <img
                                                            src={company.logo_url}
                                                            alt={company.name}
                                                            className="h-10 w-10 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <Building2 className="h-5 w-5 text-primary" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold">{company.name}</h3>
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
                                                        <p className="text-sm text-muted-foreground">{company.legal_name}</p>
                                                    )}
                                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                        {company.email && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {company.email}
                                                            </span>
                                                        )}
                                                        {company.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {company.phone}
                                                            </span>
                                                        )}
                                                        {company.city && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" />
                                                                {company.city}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className="flex items-center gap-1"
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                {!company.is_default && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleSetDefault(company)}
                                                        title="Définir par défaut"
                                                    >
                                                        <Star className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => navigate(`/companies/${company.id}`)}
                                                    title="Voir les détails"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                {(company.role === 'merchant_admin' || company.role === 'accountant') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => openDeleteDialog(company)}
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t pt-3">
                                            <Badge
                                                variant={company.role === 'merchant_admin' || company.role === 'accountant' ? 'default' : 'secondary'}
                                                className={company.role === 'merchant_admin' || company.role === 'accountant' ? 'text-white' : undefined}
                                            >
                                                {getRoleLabel(company.role)}
                                            </Badge>
                                            {company.siren && (
                                                <span className="text-xs text-muted-foreground">SIREN: {company.siren}</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer l'entreprise ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer <strong>{companyToDelete?.name}</strong> ? Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCompany}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
