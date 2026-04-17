import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Copy,
    Building2,
    User,
    Landmark,
    Mail,
    Phone,
    MapPin,
    Loader2,
    AlertCircle,
    X,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { getClientEmailValidationMessage, normalizeClientEmail } from '@/lib/client-validation';
import { ApiRequestError, clientService, sirenService, chorusProService } from '@/services/api';
import type {
    Client,
    ClientType,
    ClientSector,
    CreateClientData,
    UpdateClientData,
    SirenSearchResult,
} from '@/types';

/**
 * Page de gestion des clients
 */
export function ClientsPage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const { isReadOnly } = useSubscription();

    // États pour les clients
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<ClientType | 'public' | 'all'>('all');

    // États pour les dialogues
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // États pour la recherche SIREN
    const [sirenSearch, setSirenSearch] = useState('');
    const [sirenLoading, setSirenLoading] = useState(false);
    const [sirenResult, setSirenResult] = useState<SirenSearchResult | null>(null);
    const [sirenResults, setSirenResults] = useState<SirenSearchResult[]>([]);
    const [sirenError, setSirenError] = useState('');

    // États du formulaire
    const [formType, setFormType] = useState<ClientType>('professional');
    const [formClientSector, setFormClientSector] = useState<ClientSector | undefined>('private');
    const [formCompanyName, setFormCompanyName] = useState('');
    const [formFirstName, setFormFirstName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formSiren, setFormSiren] = useState('');
    const [formSiret, setFormSiret] = useState('');
    const [formVatNumber, setFormVatNumber] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formPostalCode, setFormPostalCode] = useState('');
    const [formCity, setFormCity] = useState('');
    const [formNotes, setFormNotes] = useState('');

    // Chorus Pro
    const [chorusSearchResults, setChorusSearchResults] = useState<any[]>([]);
    const [chorusSettings, setChorusSettings] = useState<{ enabled: boolean } | null>(null);

    // Charger les clients quand l'entreprise change
    const loadClients = useCallback(async () => {
        if (!currentCompany) return;

        setLoadingClients(true);
        try {
            const response = await clientService.getAll(currentCompany.id, {
                search: searchQuery || undefined,
                type: typeFilter === 'professional' || typeFilter === 'public' ? 'professional' : typeFilter !== 'all' ? typeFilter : undefined,
            });
            // Filtre client_sector côté client pour "public"
            let filtered = response.clients;
            if (typeFilter === 'public') {
                filtered = filtered.filter(c => c.client_sector === 'public');
            }
            setClients(filtered);
        } catch (error: any) {
            console.error('Error loading clients:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors du chargement des clients',
                variant: 'destructive',
            });
        } finally {
            setLoadingClients(false);
        }
    }, [currentCompany, searchQuery, typeFilter]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    // Charger les paramètres Chorus Pro
    useEffect(() => {
        if (!currentCompany) return;
        chorusProService.getSettings(currentCompany.id)
            .then((settings: any) => setChorusSettings(settings))
            .catch(() => {});
    }, [currentCompany?.id]);

    // Écouter les événements WebSocket pour les clients
    useWebSocketEvent<Client>('client:created', (newClient) => {
        if (currentCompany && newClient.company_id === currentCompany.id) {
            setClients(prev => [newClient, ...prev]);
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<Client>('client:updated', (updatedClient) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    }, []);

    useWebSocketEvent<{ id: string }>('client:deleted', ({ id }) => {
        setClients(prev => prev.filter(c => c.id !== id));
    }, []);

    // Appliquer le résultat SIREN au formulaire
    const applySirenResult = (result: SirenSearchResult) => {
        setSirenResult(result);

        // Pré-remplir le formulaire
        setFormCompanyName(result.company_name);
        setFormSiren(result.siren);
        setFormSiret(result.siret);
        setFormVatNumber(result.vat_number);
        setFormAddress(result.address);
        setFormPostalCode(result.postal_code);
        setFormCity(result.city);
    };

    // Recherche SIREN / raison sociale (+ Chorus Pro pour clients publics)
    const handleSirenSearch = async () => {
        if (!sirenSearch.trim()) {
            setSirenError('Veuillez entrer au moins 3 caractères');
            return;
        }

        setSirenLoading(true);
        setSirenError('');
        setSirenResult(null);
        setSirenResults([]);
        setChorusSearchResults([]);

        try {
            const isPublic = formClientSector === 'public' && currentCompany && chorusSettings?.enabled;
            const [lookupPage, chorusResult] = await Promise.all([
                sirenService.lookupPaged(sirenSearch),
                isPublic
                    ? chorusProService.searchStructure(currentCompany.id, sirenSearch).catch(() => null)
                    : Promise.resolve(null),
            ]);
            const results = lookupPage.items;
            setSirenResults(results);
            const chorusStructures = chorusResult?.listeStructures || [];
            setChorusSearchResults(chorusStructures);
            if (results.length === 0 && chorusStructures.length === 0) {
                setSirenError('Aucune entreprise trouvée');
            }
        } catch (error: any) {
            if (error instanceof ApiRequestError && error.retryAfterSeconds && error.retryAfterSeconds > 0) {
                setSirenError(
                    `Recherche temporairement indisponible, réessayez dans ${error.retryAfterSeconds} s. Privilégiez la recherche par SIREN/SIRET.`,
                );
            } else {
                setSirenError(
                    `${error.message || 'Erreur lors de la recherche'} Privilégiez la recherche par SIREN/SIRET.`,
                );
            }
        } finally {
            setSirenLoading(false);
        }
    };

    // Sélection d'un résultat Chorus Pro
    const selectChorusResult = (structure: any) => {
        const identifiant = structure.identifiantStructure || '';
        const isSiret = structure.typeIdentifiantStructure === 'SIRET';
        const designation = structure.designationStructure || '';

        setFormCompanyName(designation);
        if (isSiret) {
            setFormSiret(identifiant);
        } else {
            setFormSiren(identifiant);
        }
        setSirenResult({ company_name: designation, siren: isSiret ? '' : identifiant, siret: isSiret ? identifiant : '', vat_number: '', address: '', postal_code: '', city: '', legal_form: '', naf_code: '', creation_date: '' });
        setChorusSearchResults([]);
        setSirenResults([]);
    };

    // Réinitialiser le formulaire
    const resetForm = () => {
        setFormType('professional');
        setFormClientSector('private');
        setFormCompanyName('');
        setFormFirstName('');
        setFormLastName('');
        setFormSiren('');
        setFormSiret('');
        setFormVatNumber('');
        setFormEmail('');
        setFormPhone('');
        setFormAddress('');
        setFormPostalCode('');
        setFormCity('');
        setFormNotes('');
        setSirenSearch('');
        setSirenResult(null);
        setSirenResults([]);
        setSirenError('');
        setChorusSearchResults([]);
    };

    // Remplir le formulaire avec les données d'un client
    const fillFormWithClient = (client: Client) => {
        setFormType(client.type);
        setFormClientSector(client.client_sector || (client.type === 'professional' ? 'private' : undefined));
        setFormCompanyName(client.company_name || '');
        setFormFirstName(client.first_name || '');
        setFormLastName(client.last_name || '');
        setFormSiren(client.siren || '');
        setFormSiret(client.siret || '');
        setFormVatNumber(client.vat_number || '');
        setFormEmail(client.email || '');
        setFormPhone(client.phone || '');
        setFormAddress(client.address || '');
        setFormPostalCode(client.postal_code || '');
        setFormCity(client.city || '');
        setFormNotes(client.notes || '');
    };

    // Ouvrir le dialogue de création
    const openCreateDialog = () => {
        resetForm();
        setIsCreateDialogOpen(true);
    };

    // Ouvrir le dialogue d'édition
    const openEditDialog = (client: Client) => {
        setSelectedClient(client);
        fillFormWithClient(client);
        setIsEditDialogOpen(true);
    };

    // Ouvrir le dialogue de suppression
    const openDeleteDialog = (client: Client) => {
        setSelectedClient(client);
        setIsDeleteDialogOpen(true);
    };

    // Créer un client
    const handleCreateClient = async () => {
        if (!currentCompany) return;

        // Validation
        if (formType === 'professional' && !formCompanyName.trim()) {
            toast({
                title: 'Erreur',
                description: 'La raison sociale est requise',
                variant: 'destructive',
            });
            return;
        }
        if (formType === 'individual' && !formLastName.trim()) {
            toast({
                title: 'Erreur',
                description: 'Le nom est requis',
                variant: 'destructive',
            });
            return;
        }
        const emailValidationMessage = getClientEmailValidationMessage(formEmail);
        if (emailValidationMessage) {
            toast({
                title: 'Erreur',
                description: emailValidationMessage,
                variant: 'destructive',
            });
            return;
        }

        const clientEmail = normalizeClientEmail(formEmail);

        setIsSubmitting(true);
        try {
            const data: CreateClientData = {
                type: formType,
                client_sector: formClientSector,
                company_name: formType === 'professional' ? formCompanyName : undefined,
                first_name: formType === 'individual' ? formFirstName : undefined,
                last_name: formType === 'individual' ? formLastName : undefined,
                siren: formSiren || undefined,
                siret: formSiret || undefined,
                vat_number: formVatNumber || undefined,
                email: clientEmail,
                phone: formPhone || undefined,
                address: formAddress || undefined,
                postal_code: formPostalCode || undefined,
                city: formCity || undefined,
                notes: formNotes || undefined,
            };

            await clientService.create(currentCompany.id, data);
            // Le WebSocket s'occupe d'ajouter le client à la liste
            setIsCreateDialogOpen(false);
            resetForm();
            toast({
                title: 'Succès',
                description: 'Client créé avec succès',
            });
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors de la création',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Mettre à jour un client
    const handleUpdateClient = async () => {
        if (!currentCompany || !selectedClient) return;

        const emailValidationMessage = getClientEmailValidationMessage(formEmail);
        if (emailValidationMessage) {
            toast({
                title: 'Erreur',
                description: emailValidationMessage,
                variant: 'destructive',
            });
            return;
        }

        const clientEmail = normalizeClientEmail(formEmail);

        setIsSubmitting(true);
        try {
            const data: UpdateClientData = {
                type: formType,
                client_sector: formClientSector,
                company_name: formType === 'professional' ? formCompanyName : undefined,
                first_name: formType === 'individual' ? formFirstName : undefined,
                last_name: formType === 'individual' ? formLastName : undefined,
                siren: formSiren || undefined,
                siret: formSiret || undefined,
                vat_number: formVatNumber || undefined,
                email: clientEmail,
                phone: formPhone || undefined,
                address: formAddress || undefined,
                postal_code: formPostalCode || undefined,
                city: formCity || undefined,
                notes: formNotes || undefined,
            };

            await clientService.update(currentCompany.id, selectedClient.id, data);
            // Le WebSocket s'occupe de mettre à jour le client
            setIsEditDialogOpen(false);
            setSelectedClient(null);
            resetForm();
            toast({
                title: 'Succès',
                description: 'Client mis à jour avec succès',
            });
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors de la mise à jour',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Supprimer un client
    const handleDeleteClient = async () => {
        if (!currentCompany || !selectedClient) return;

        setIsSubmitting(true);
        try {
            await clientService.delete(currentCompany.id, selectedClient.id);
            // Le WebSocket s'occupe de supprimer le client de la liste
            setIsDeleteDialogOpen(false);
            setSelectedClient(null);
            toast({
                title: 'Succès',
                description: 'Client supprimé avec succès',
            });
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors de la suppression',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dupliquer un client
    const handleDuplicateClient = async (client: Client) => {
        if (!currentCompany) return;

        try {
            await clientService.duplicate(currentCompany.id, client.id);
            // Le WebSocket s'occupe d'ajouter le client dupliqué
            toast({
                title: 'Succès',
                description: 'Client dupliqué avec succès',
            });
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors de la duplication',
                variant: 'destructive',
            });
        }
    };

    // Obtenir le nom d'affichage d'un client
    const getClientDisplayName = (client: Client) => {
        if (client.type === 'professional') {
            return client.company_name || 'Entreprise sans nom';
        }
        return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client sans nom';
    };

    // Rendu d'une carte client — style SENED
    const renderClientCard = (client: Client) => (
        <Card
            key={client.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate(`/clients/${client.id}`)}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        {client.client_sector === 'public' ? (
                            <Landmark className="h-5 w-5 text-primary" />
                        ) : client.type === 'professional' ? (
                            <Building2 className="h-5 w-5 text-primary" />
                        ) : (
                            <User className="h-5 w-5 text-primary" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {client.chorus_pro_eligibility_status === 'eligible' && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Chorus
                            </Badge>
                        )}
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                            Actif
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {permissions.canEditClient && (
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(client); }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Modifier
                                    </DropdownMenuItem>
                                )}
                                {permissions.canCreateClient && (
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateClient(client); }}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        Dupliquer
                                    </DropdownMenuItem>
                                )}
                                {permissions.canDeleteClient && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={(e) => { e.stopPropagation(); openDeleteDialog(client); }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Supprimer
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <h3 className="font-semibold text-base truncate">
                    {getClientDisplayName(client)}
                </h3>

                {client.siret && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        RCS : {client.siret}
                    </p>
                )}

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {client.email && (
                        <div className="flex items-center gap-2 truncate">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{client.email}</span>
                        </div>
                    )}
                    {client.phone && (
                        <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{client.phone}</span>
                        </div>
                    )}
                    {(client.city || client.postal_code || client.address) && (
                        <div className="flex items-center gap-2 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                {[client.address, client.postal_code, client.city].filter(Boolean).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    // Rendu du formulaire client
    const renderClientForm = (isCreate: boolean) => (
        <div className="space-y-6">
            {/* Recherche SIREN (seulement pour création de professionnels) */}
            {isCreate && formType === 'professional' && (
                <Card className="bg-muted/50">
                    <CardContent className="p-4">
                        <Label className="text-sm font-medium">Recherche par nom ou SIREN</Label>
                        <div className="mt-2 flex gap-2">
                            <Input
                                placeholder="Ex: SENED ou 123456789"
                                value={sirenSearch}
                                onChange={(e) => setSirenSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSirenSearch()}
                            />
                            <Button 
                                type="button" 
                                onClick={handleSirenSearch}
                                disabled={sirenLoading}
                            >
                                {sirenLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                                <span className="ml-2">Rechercher</span>
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Remplissage automatique des informations de l'entreprise. Pour limiter les blocages,
                            privilégiez la recherche par SIREN/SIRET.
                        </p>
                        {sirenError && (
                            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {sirenError}
                            </p>
                        )}
                        {sirenResult && (
                            <p className="text-xs text-green-600 mt-2">
                                ✓ Entreprise trouvée : {sirenResult.company_name}
                            </p>
                        )}
                        {sirenResults.length > 0 && !sirenResult && (
                            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                                {sirenResults.map((result) => (
                                    <button
                                        key={result.siret}
                                        type="button"
                                        onClick={() => {
                                            applySirenResult(result);
                                            setSirenResults([]);
                                            toast({
                                                title: 'Succès',
                                                description: 'Entreprise sélectionnée',
                                            });
                                        }}
                                        className="w-full rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
                                    >
                                        <p className="text-sm font-medium">{result.company_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            SIREN: {result.siren} | SIRET: {result.siret}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {result.address} {result.postal_code} {result.city}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                        {chorusSearchResults.length > 0 && !sirenResult && (
                            <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Structures Chorus Pro</p>
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {chorusSearchResults.map((structure: any) => (
                                        <button
                                            key={structure.idStructureCPP}
                                            type="button"
                                            onClick={() => selectChorusResult(structure)}
                                            className="w-full rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
                                        >
                                            <p className="text-sm font-medium">{structure.designationStructure}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {structure.typeIdentifiantStructure}: {structure.identifiantStructure}
                                                {' • '}Statut: {structure.statut}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Type de client */}
            <div>
                <Label>Type de client</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                        type="button"
                        onClick={() => { setFormType('professional'); setFormClientSector('private'); }}
                        className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                            formType === 'professional' && formClientSector === 'private'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <Building2 className={`h-5 w-5 ${formType === 'professional' && formClientSector === 'private' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Entreprise</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFormType('individual'); setFormClientSector(undefined); }}
                        className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                            formType === 'individual'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <User className={`h-5 w-5 ${formType === 'individual' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Particulier</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFormType('professional'); setFormClientSector('public'); }}
                        className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                            formClientSector === 'public'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <Landmark className={`h-5 w-5 ${formClientSector === 'public' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Public</span>
                    </button>
                </div>
            </div>

            {/* Champs selon le type */}
            {formType === 'professional' ? (
                <>
                    <div>
                        <Label htmlFor="company_name">Raison sociale *</Label>
                        <Input
                            id="company_name"
                            value={formCompanyName}
                            onChange={(e) => setFormCompanyName(e.target.value)}
                            className="mt-1"
                            disabled={!!sirenResult}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="siren">SIREN</Label>
                            <Input
                                id="siren"
                                value={formSiren}
                                onChange={(e) => setFormSiren(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                className="mt-1"
                                maxLength={9}
                                placeholder="123456789"
                                disabled={!!sirenResult}
                            />
                        </div>
                        <div>
                            <Label htmlFor="siret">SIRET</Label>
                            <Input
                                id="siret"
                                value={formSiret}
                                onChange={(e) => setFormSiret(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                className="mt-1"
                                maxLength={14}
                                placeholder="12345678901234"
                                disabled={!!sirenResult}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="vat_number">Numéro TVA</Label>
                            <Input
                                id="vat_number"
                                value={formVatNumber}
                                onChange={(e) => setFormVatNumber(e.target.value)}
                                className="mt-1"
                                placeholder="FR12345678901"
                                disabled={!!sirenResult}
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="first_name">Prénom</Label>
                            <Input
                                id="first_name"
                                value={formFirstName}
                                onChange={(e) => setFormFirstName(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="last_name">Nom *</Label>
                            <Input
                                id="last_name"
                                value={formLastName}
                                onChange={(e) => setFormLastName(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formEmail}
                            onChange={(e) => setFormEmail(e.target.value)}
                            className="mt-1"
                            placeholder="email@exemple.com"
                        />
                    </div>
                </>
            )}

            {/* Téléphone */}
            <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                    id="phone"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="mt-1"
                />
            </div>

            {/* Adresse */}
            <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                    id="address"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="mt-1"
                    disabled={!!sirenResult}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input
                        id="postal_code"
                        value={formPostalCode}
                        onChange={(e) => setFormPostalCode(e.target.value)}
                        className="mt-1"
                        disabled={!!sirenResult}
                    />
                </div>
                <div>
                    <Label htmlFor="city">Ville</Label>
                    <Input
                        id="city"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        className="mt-1"
                        disabled={!!sirenResult}
                    />
                </div>
            </div>

            {/* Notes */}
            <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                />
            </div>
        </div>
    );

    // Aucune entreprise sélectionnée
    if (!currentCompany) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Clients</h1>
                    <p className="text-muted-foreground">Gérez votre portefeuille client</p>
                </div>

                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mb-2 text-lg font-medium">Aucune entreprise sélectionnée</h3>
                        <p className="text-muted-foreground">
                            Veuillez sélectionner une entreprise dans le menu pour gérer vos clients.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* En-tête */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Clients</h1>
                    <p className="text-muted-foreground">Gérez votre portefeuille client</p>
                </div>
                {permissions.canCreateClient && (
                    <Button
                        onClick={openCreateDialog}
                        disabled={isReadOnly}
                        title={isReadOnly ? 'Abonnement requis' : undefined}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouveau client
                    </Button>
                )}
            </div>

            {/* Recherche full-width */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Rechercher un client par nom, email ou RCS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                        onClick={() => setSearchQuery('')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Filtres type */}
            <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as ClientType | 'public' | 'all')}>
                <TabsList>
                    <TabsTrigger value="all">Tous</TabsTrigger>
                    <TabsTrigger value="professional">Pro</TabsTrigger>
                    <TabsTrigger value="individual">Particuliers</TabsTrigger>
                    <TabsTrigger value="public">Public</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Liste des clients */}
            {loadingClients ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : clients.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mb-2 text-lg font-medium">
                            {searchQuery || typeFilter !== 'all' ? 'Aucun résultat' : 'Aucun client'}
                        </h3>
                        <p className="mb-4 text-muted-foreground">
                            {searchQuery || typeFilter !== 'all' 
                                ? 'Aucun client ne correspond à votre recherche.'
                                : 'Ajoutez votre premier client pour créer des devis.'}
                        </p>
                        {!searchQuery && typeFilter === 'all' && (
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter un client
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {clients.map((client) => renderClientCard(client))}
                </div>
            )}

            {/* Dialog de création */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] gap-0 p-0">
                    <DialogHeader className="px-4">
                        <DialogTitle>Nouveau client</DialogTitle>
                        <DialogDescription>
                            Ajoutez un nouveau client à votre liste
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-4 py-3">
                        {renderClientForm(true)}
                    </DialogBody>
                    <DialogFooter className="border-t px-4 py-4">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleCreateClient} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog d'édition */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] gap-0 p-0">
                    <DialogHeader className="px-4">
                        <DialogTitle>Modifier le client</DialogTitle>
                        <DialogDescription>
                            Modifiez les informations du client
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-4 py-3">
                        {renderClientForm(false)}
                    </DialogBody>
                    <DialogFooter className="border-t px-4 py-4">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleUpdateClient} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmation de suppression */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer ce client ?
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteClient}
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
