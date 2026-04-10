import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, Plus, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { EnterpriseLookupField } from '@/components/shared/EnterpriseLookupField';
import { useCompany } from '@/hooks/useCompany';
import {
    companyService,
    type AccountantLinkRequest,
    type AccountantLinkRequestCompanySummary,
    type LinkedClientWithStats,
    type MerchantSignupInvitation,
} from '@/services/api';
import type { SirenSearchResult } from '@/types';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

export function AccountantDashboard() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { companies, currentCompany, loading: companiesLoading } = useCompany();
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<LinkedClientWithStats[]>([]);
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [merchantQuery, setMerchantQuery] = useState('');
    const [merchantResults, setMerchantResults] = useState<AccountantLinkRequestCompanySummary[]>([]);
    const [merchantSearchLoading, setMerchantSearchLoading] = useState(false);
    const [outgoingRequests, setOutgoingRequests] = useState<AccountantLinkRequest[]>([]);
    const [merchantSignupInvitations, setMerchantSignupInvitations] = useState<MerchantSignupInvitation[]>([]);
    const [creatingRequestFor, setCreatingRequestFor] = useState<string | null>(null);
    const [selectedEnterprise, setSelectedEnterprise] = useState<SirenSearchResult | null>(null);
    const [inviteMerchantAdminEmail, setInviteMerchantAdminEmail] = useState('');
    const [invitingNewMerchant, setInvitingNewMerchant] = useState(false);
    const [cancellingMerchantSignupInvitationId, setCancellingMerchantSignupInvitationId] = useState<string | null>(null);

    const cabinetCompany = useMemo(() => {
        if (currentCompany && ['accountant', 'accountant_consultant'].includes(currentCompany.role)) {
            return currentCompany;
        }

        return (
            companies.find((company) =>
                company.is_default && ['accountant', 'accountant_consultant'].includes(company.role),
            )
            || companies.find((company) =>
                ['accountant', 'accountant_consultant'].includes(company.role),
            )
            || null
        );
    }, [companies, currentCompany]);

    const canCreateMerchantLinkRequest = cabinetCompany?.role === 'accountant';
    const normalizedInviteMerchantAdminEmail = inviteMerchantAdminEmail.trim().toLowerCase();
    const isInviteMerchantAdminEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInviteMerchantAdminEmail);

    useEffect(() => {
        const loadData = async () => {
            if (companiesLoading) {
                return;
            }

            if (!cabinetCompany) {
                setClients([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const [linkedClients, pendingRequests, pendingMerchantSignupInvitations] = await Promise.all([
                    companyService.getLinkedClients(cabinetCompany.id),
                    cabinetCompany.role === 'accountant'
                        ? companyService.getAccountantLinkRequests(cabinetCompany.id, 'outgoing')
                        : Promise.resolve([]),
                    cabinetCompany.role === 'accountant'
                        ? companyService.getMerchantSignupInvitations(cabinetCompany.id)
                        : Promise.resolve([]),
                ]);
                setClients(linkedClients as LinkedClientWithStats[]);
                setOutgoingRequests(pendingRequests as AccountantLinkRequest[]);
                setMerchantSignupInvitations(pendingMerchantSignupInvitations as MerchantSignupInvitation[]);
            } catch (error) {
                console.error('Error loading linked clients:', error);
                setClients([]);
                setOutgoingRequests([]);
                setMerchantSignupInvitations([]);
                toast({
                    variant: 'destructive',
                    title: 'Chargement impossible',
                    description: 'Les dossiers clients, demandes de liaison et invitations marchandes n’ont pas pu être chargés.',
                });
            } finally {
                setLoading(false);
            }
        };
        void loadData();
    }, [cabinetCompany?.id, companiesLoading, toast]);

    const handleSearchMerchants = async () => {
        if (!cabinetCompany || cabinetCompany.role !== 'accountant') {
            return;
        }

        if (!merchantQuery.trim()) {
            setMerchantResults([]);
            return;
        }

        try {
            setMerchantSearchLoading(true);
            const results = await companyService.searchMerchants(cabinetCompany.id, merchantQuery);
            setMerchantResults(results);
        } catch (error) {
            console.error('Error searching merchants:', error);
            setMerchantResults([]);
            toast({
                variant: 'destructive',
                title: 'Recherche impossible',
                description: 'Les commerçants éligibles n’ont pas pu être recherchés.',
            });
        } finally {
            setMerchantSearchLoading(false);
        }
    };

    const refreshDashboardData = async () => {
        if (!cabinetCompany) return;

        const [linkedClients, pendingRequests, pendingMerchantSignupInvitations] = await Promise.all([
            companyService.getLinkedClients(cabinetCompany.id),
            cabinetCompany.role === 'accountant'
                ? companyService.getAccountantLinkRequests(cabinetCompany.id, 'outgoing')
                : Promise.resolve([]),
            cabinetCompany.role === 'accountant'
                ? companyService.getMerchantSignupInvitations(cabinetCompany.id)
                : Promise.resolve([]),
        ]);

        setClients(linkedClients as LinkedClientWithStats[]);
        setOutgoingRequests(pendingRequests as AccountantLinkRequest[]);
        setMerchantSignupInvitations(pendingMerchantSignupInvitations as MerchantSignupInvitation[]);
    };

    const resetRequestDialogState = () => {
        setMerchantQuery('');
        setMerchantResults([]);
        setMerchantSearchLoading(false);
        setCreatingRequestFor(null);
        setSelectedEnterprise(null);
        setInviteMerchantAdminEmail('');
        setInvitingNewMerchant(false);
    };

    const handleRequestDialogOpenChange = (open: boolean) => {
        setRequestDialogOpen(open);
        if (!open) {
            resetRequestDialogState();
        }
    };

    const handleCreateLinkRequest = async (merchantCompanyId: string) => {
        if (!cabinetCompany || cabinetCompany.role !== 'accountant') {
            return;
        }

        try {
            setCreatingRequestFor(merchantCompanyId);
            await companyService.createAccountantLinkRequest(cabinetCompany.id, merchantCompanyId);
            toast({
                title: 'Demande envoyée',
                description: 'Le commerçant peut maintenant accepter ou refuser la liaison depuis son espace entreprise.',
            });
            setMerchantResults((prev) => prev.filter((merchant) => merchant.id !== merchantCompanyId));
            await refreshDashboardData();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Envoi impossible',
                description: error.message || 'La demande de liaison n’a pas pu être envoyée.',
            });
        } finally {
            setCreatingRequestFor(null);
        }
    };

    const handleInviteNewMerchantAdmin = async () => {
        if (!cabinetCompany || cabinetCompany.role !== 'accountant' || !selectedEnterprise || !isInviteMerchantAdminEmailValid) {
            return;
        }

        try {
            setInvitingNewMerchant(true);
            const result = await companyService.inviteNewMerchantAdmin(cabinetCompany.id, {
                email: normalizedInviteMerchantAdminEmail,
                company_name: selectedEnterprise.company_name,
                siren: selectedEnterprise.siren,
                siret: selectedEnterprise.siret || undefined,
                address: selectedEnterprise.address || undefined,
                postal_code: selectedEnterprise.postal_code || undefined,
                city: selectedEnterprise.city || undefined,
                country: selectedEnterprise.country_code || undefined,
            });

            if (result.status === 'existing_merchant') {
                setMerchantResults((prev) => {
                    const nextResult: AccountantLinkRequestCompanySummary = {
                        id: result.merchant_company.id,
                        name: result.merchant_company.name,
                        legal_name: null,
                        siren: result.merchant_company.siren,
                        email: null,
                        city: selectedEnterprise.city || null,
                        logo_url: null,
                    };

                    return [
                        nextResult,
                        ...prev.filter((merchant) => merchant.id !== result.merchant_company.id),
                    ];
                });
                setMerchantQuery(result.merchant_company.siren || result.merchant_company.name);
                setSelectedEnterprise(null);
                setInviteMerchantAdminEmail('');
                toast({
                    title: 'Marchand déjà inscrit',
                    description: 'Ce commerçant existe déjà sur la plateforme. Vous pouvez lui envoyer la demande de liaison ci-dessus.',
                });
                return;
            }

            await refreshDashboardData();
            toast({
                title: 'Invitation envoyée',
                description: 'Le futur administrateur marchand recevra un email pour créer son entreprise puis la lier automatiquement à votre cabinet.',
            });
            handleRequestDialogOpenChange(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Invitation impossible',
                description: error.message || 'Le commerçant n’a pas pu être invité.',
            });
        } finally {
            setInvitingNewMerchant(false);
        }
    };

    const handleCancelMerchantSignupInvitation = async (invitationId: string) => {
        if (!cabinetCompany || cabinetCompany.role !== 'accountant') {
            return;
        }

        try {
            setCancellingMerchantSignupInvitationId(invitationId);
            await companyService.cancelMerchantSignupInvitation(cabinetCompany.id, invitationId);
            setMerchantSignupInvitations((previous) =>
                previous.filter((invitation) => invitation.id !== invitationId),
            );
            toast({
                title: 'Invitation annulée',
                description: 'L’invitation marchand a été supprimée.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Annulation impossible',
                description: error.message || 'L’invitation marchand n’a pas pu être annulée.',
            });
        } finally {
            setCancellingMerchantSignupInvitationId(null);
        }
    };

    if (loading || companiesLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!cabinetCompany) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">Dossiers clients</h1>
                <p className="text-muted-foreground">
                    Aucun cabinet comptable actif n’est disponible pour cet utilisateur.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Dossiers clients</h1>
                    <p className="text-sm text-muted-foreground">
                        Accédez aux dossiers clients liés à votre cabinet et ouvrez chaque espace de travail.
                    </p>
                </div>
                {canCreateMerchantLinkRequest && (
                    <Button onClick={() => setRequestDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un commerçant
                    </Button>
                )}
            </div>
            {outgoingRequests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Demandes de liaison en attente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {outgoingRequests.map((request) => (
                            <div
                                key={request.id}
                                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="space-y-1">
                                    <p className="font-medium">{request.merchant_company.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {[request.merchant_company.siren ? `SIREN : ${request.merchant_company.siren}` : null, request.merchant_company.city].filter(Boolean).join(' • ') || 'Informations partielles'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Envoyée le {new Date(request.created_at).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {request.request_origin === 'new_client_invitation' && (
                                        <Badge variant="outline">Nouveau client</Badge>
                                    )}
                                    <Badge variant="secondary">En attente du marchand</Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            {merchantSignupInvitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Invitations marchand en attente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {merchantSignupInvitations.map((invitation) => (
                            <div
                                key={invitation.id}
                                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {invitation.company_name || 'Entreprise à créer'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {[invitation.siren ? `SIREN : ${invitation.siren}` : null, invitation.city, invitation.email].filter(Boolean).join(' • ') || 'Informations partielles'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Envoyée le {new Date(invitation.created_at).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Création de compte</Badge>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void handleCancelMerchantSignupInvitation(invitation.id)}
                                        disabled={cancellingMerchantSignupInvitationId === invitation.id}
                                    >
                                        {cancellingMerchantSignupInvitationId === invitation.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Annuler
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Clients liés ({clients.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {clients.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            Aucun client lié à votre cabinet pour le moment.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Entreprise</TableHead>
                                    <TableHead>SIRET</TableHead>
                                    <TableHead>Ville</TableHead>
                                    <TableHead className="text-right">CA annuel</TableHead>
                                    <TableHead className="text-right">En retard</TableHead>
                                    <TableHead className="text-right">Factures</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map((client) => (
                                    <TableRow
                                        key={client.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/accountant/clients/${client.id}`)}
                                    >
                                        <TableCell className="font-medium">{client.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{client.siren || '—'}</TableCell>
                                        <TableCell>{client.city || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(client.stats?.annual_revenue || 0)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(client.stats?.overdue_count || 0) > 0 ? (
                                                <Badge variant="destructive">
                                                    {client.stats.overdue_count} ({formatCurrency(client.stats.overdue_amount)})
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {client.stats?.invoice_count || 0}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={requestDialogOpen} onOpenChange={handleRequestDialogOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Ajouter un commerçant</DialogTitle>
                        <DialogDescription>
                            Recherchez un commerçant déjà inscrit sur la plateforme ou invitez un nouvel administrateur marchand depuis cette même modale.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h3 className="font-medium">Commerçant déjà inscrit</h3>
                                <p className="text-sm text-muted-foreground">
                                    Recherchez un commerçant existant sur la plateforme puis envoyez-lui une demande de liaison.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nom du commerçant ou SIREN"
                                    value={merchantQuery}
                                    onChange={(event) => setMerchantQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void handleSearchMerchants();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleSearchMerchants()}
                                    disabled={merchantSearchLoading || !merchantQuery.trim()}
                                >
                                    {merchantSearchLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {merchantResults.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    Aucun commerçant éligible affiché pour le moment.
                                </div>
                            ) : (
                                merchantResults.map((merchant) => (
                                    <div
                                        key={merchant.id}
                                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="space-y-1">
                                            <p className="font-medium">{merchant.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {[merchant.siren ? `SIREN : ${merchant.siren}` : null, merchant.city].filter(Boolean).join(' • ') || 'Informations partielles'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => void handleCreateLinkRequest(merchant.id)}
                                            disabled={creatingRequestFor === merchant.id}
                                        >
                                            {creatingRequestFor === merchant.id ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Send className="mr-2 h-4 w-4" />
                                            )}
                                            Envoyer la demande
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="font-medium">Inviter un commerçant non inscrit</h3>
                                <p className="text-sm text-muted-foreground">
                                    Recherchez l’entreprise par nom, SIREN ou SIRET puis indiquez l’email du futur administrateur marchand. S’il n’a pas encore de compte, il le créera depuis le mail reçu.
                                </p>
                            </div>
                            <EnterpriseLookupField
                                mode="authenticated"
                                onSelect={(enterprise) => setSelectedEnterprise(enterprise)}
                                onClear={() => setSelectedEnterprise(null)}
                                selectedName={selectedEnterprise?.company_name}
                                label="Entreprise à inviter"
                                placeholder="Nom, SIREN ou SIRET..."
                            />
                            <div className="space-y-2">
                                <Input
                                    type="email"
                                    placeholder="email@entreprise.fr"
                                    value={inviteMerchantAdminEmail}
                                    onChange={(event) => setInviteMerchantAdminEmail(event.target.value)}
                                />
                                {inviteMerchantAdminEmail.trim().length > 0 && !isInviteMerchantAdminEmailValid && (
                                    <p className="text-sm text-destructive">
                                        Saisissez une adresse email valide.
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    onClick={() => void handleInviteNewMerchantAdmin()}
                                    disabled={!selectedEnterprise || !isInviteMerchantAdminEmailValid || invitingNewMerchant}
                                >
                                    {invitingNewMerchant ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Envoyer l’invitation
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleRequestDialogOpenChange(false)}>
                            Fermer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
