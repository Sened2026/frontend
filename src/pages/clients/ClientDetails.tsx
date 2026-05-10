import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Building2, User, Mail, Phone, MapPin,
    FileText, Receipt, AlertTriangle, Clock, CheckCircle,
    Filter, ArrowUpDown, Bell, Pencil, Trash2, ChevronLeft, ChevronRight, List,
    Landmark, CheckCircle2, XCircle, AlertCircle, HelpCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { clientService, quoteService, invoiceService, reminderService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import type { Client, Reminder } from '@/types';

interface ClientStats {
    total_invoiced: number;
    total_pending: number;
    total_overdue: number;
    documents_count: number;
}

interface Document {
    id: string;
    number: string;
    type: 'quote' | 'invoice' | 'credit_note';
    date: string;
    amount: number;
    status: string;
}

const documentTypeLabels: Record<string, string> = {
    quote: 'Devis',
    invoice: 'Facture',
    credit_note: 'Avoir',
};

const quoteStatusLabels: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    accepted: 'Accepté',
    signed: 'Signé',
    refused: 'Refusé',
    expired: 'Expiré',
    converted: 'Converti',
};

const invoiceStatusLabels: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyée',
    paid: 'Payée',
    overdue: 'En retard',
    cancelled: 'Annulée',
};

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    signed: 'bg-indigo-100 text-indigo-800',
    accepted: 'bg-green-100 text-green-800',
    refused: 'bg-red-100 text-red-800',
    expired: 'bg-orange-100 text-orange-800',
    converted: 'bg-purple-100 text-purple-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-500',
    pending: 'bg-yellow-100 text-yellow-800',
    succeeded: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
};

const reminderTypeLabels: Record<string, string> = {
    before_due: 'Automatique',
    after_due: 'Automatique',
    quote_expiring: 'Automatique',
    manual: 'Manuelle',
};

const reminderStatusLabels: Record<string, string> = {
    pending: 'En attente',
    sent: 'Envoyée',
    failed: 'Échec',
    cancelled: 'Annulée',
};

export function ClientDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();

    const [client, setClient] = useState<Client | null>(null);
    const [stats, setStats] = useState<ClientStats | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [invoicesModalOpen, setInvoicesModalOpen] = useState(false);
    const [modalPage, setModalPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Filters
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [reminderSort, setReminderSort] = useState<'desc' | 'asc'>('desc');

    const [chorusVerifying, setChorusVerifying] = useState(false);

    // Stocker l'ID de l'entreprise pour éviter les re-renders
    const companyId = currentCompany?.id;

    // Vérifier l'éligibilité Chorus Pro
    const handleVerifyChorus = async () => {
        if (!companyId || !client) return;
        setChorusVerifying(true);
        try {
            const updatedClient = await clientService.verifyChorus(companyId, client.id);
            setClient(updatedClient);
            toast({
                title: updatedClient.chorus_pro_eligibility_status === 'eligible'
                    ? 'Structure Chorus Pro trouvée'
                    : updatedClient.chorus_pro_eligibility_status === 'ineligible'
                    ? 'Structure non éligible'
                    : 'Erreur de vérification',
                description: updatedClient.chorus_pro_eligibility_status === 'eligible'
                    ? `Structure : ${updatedClient.chorus_pro_structure_label}`
                    : updatedClient.chorus_pro_eligibility_status === 'ineligible'
                    ? 'Ce client n\'est pas reconnu comme destinataire Chorus Pro actif'
                    : 'Une erreur est survenue lors de la vérification. Réessayez ultérieurement.',
                variant: updatedClient.chorus_pro_eligibility_status === 'eligible' ? 'default' : 'destructive',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de vérifier l\'éligibilité Chorus Pro',
            });
        } finally {
            setChorusVerifying(false);
        }
    };

    // Fonction de chargement des données (extraite pour réutilisation WebSocket)
    const loadData = useCallback(async () => {
        if (!companyId || !id) return;
        setLoading(true);
        try {
            // Load client details
            const clientData = await clientService.getById(companyId, id);
            setClient(clientData);

            // Load quotes and invoices for this client
            const [quotesData, invoicesData, creditNotesData] = await Promise.all([
                quoteService.getAll(companyId, { client_id: id, limit: 100 }),
                invoiceService.getAll(companyId, { client_id: id, limit: 100 }),
                invoiceService.getAll(companyId, { client_id: id, type: 'credit_note', limit: 100 }),
            ]);

            // Calculate stats
            const invoices = invoicesData.invoices || [];
            const creditNotes = creditNotesData.invoices || [];
            const quotes = quotesData.quotes || [];

            const totalInvoiced = [...invoices, ...creditNotes].reduce((sum, inv) => sum + inv.total, 0);
            const totalPending = invoices
                .filter(inv => ['sent'].includes(inv.status))
                .reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0);
            const totalOverdue = invoices
                .filter(inv => inv.status === 'overdue')
                .reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0);

            setStats({
                total_invoiced: totalInvoiced,
                total_pending: totalPending,
                total_overdue: totalOverdue,
                documents_count: invoices.length + creditNotes.length + quotes.length,
            });

            // Combine documents
            const allDocs: Document[] = [
                ...quotes.map(q => ({
                    id: q.id,
                    number: q.quote_number,
                    type: 'quote' as const,
                    date: q.issue_date,
                    amount: q.total,
                    status: q.status,
                })),
                ...invoices.map(inv => ({
                    id: inv.id,
                    number: inv.invoice_number,
                    type: 'invoice' as const,
                    date: inv.issue_date,
                    amount: inv.total,
                    status: inv.status,
                })),
                ...creditNotes.map(inv => ({
                    id: inv.id,
                    number: inv.invoice_number,
                    type: 'credit_note' as const,
                    date: inv.issue_date,
                    amount: inv.total,
                    status: inv.status,
                })),
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setDocuments(allDocs);

            // Load reminders for this client
            try {
                const remindersData = await reminderService.getAll(companyId, { client_id: id });
                setReminders(remindersData.reminders || []);
            } catch {
                // Reminders might not be available
                setReminders([]);
            }

        } catch (error: any) {
            console.error('Error loading client:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger les détails du client',
            });
            navigate('/clients');
        } finally {
            setLoading(false);
        }
    }, [companyId, id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Fonction pour recalculer les stats à partir des documents
    const recalculateStats = useCallback((docs: Document[]) => {
        const invoiceDocs = docs.filter(d => d.type === 'invoice');
        const creditNoteDocs = docs.filter(d => d.type === 'credit_note');
        const totalInvoiced = [...invoiceDocs, ...creditNoteDocs].reduce((sum, inv) => sum + inv.amount, 0);
        const totalPending = invoiceDocs
            .filter(inv => ['sent'].includes(inv.status))
            .reduce((sum, inv) => sum + inv.amount, 0);
        const totalOverdue = invoiceDocs
            .filter(inv => inv.status === 'overdue')
            .reduce((sum, inv) => sum + inv.amount, 0);

        setStats({
            total_invoiced: totalInvoiced,
            total_pending: totalPending,
            total_overdue: totalOverdue,
            documents_count: docs.length,
        });
    }, []);

    // WebSocket listeners pour les mises à jour en temps réel
    // Mettre à jour le client dynamiquement
    useWebSocketEvent(['client:updated'], (updatedClient: any) => {
        if (updatedClient.id === id) {
            setClient(updatedClient);
        }
    }, [id]);

    // Gestion dynamique des factures
    useWebSocketEvent(['invoice:created'], (invoice: any) => {
        if (invoice.client_id === id) {
            const newDoc: Document = {
                id: invoice.id,
                number: invoice.invoice_number,
                type: invoice.type === 'credit_note' ? 'credit_note' : 'invoice',
                date: invoice.issue_date,
                amount: invoice.total,
                status: invoice.status,
            };
            setDocuments(prev => {
                const updated = [newDoc, ...prev].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                recalculateStats(updated);
                return updated;
            });
        }
    }, [id, recalculateStats]);

    useWebSocketEvent(['invoice:updated', 'invoice:status_changed'], (invoice: any) => {
        if (invoice.client_id === id) {
            setDocuments(prev => {
                const updated = prev.map(doc => 
                    doc.id === invoice.id 
                        ? {
                            ...doc,
                            number: invoice.invoice_number,
                            amount: invoice.total,
                            status: invoice.status,
                            date: invoice.issue_date,
                        }
                        : doc
                );
                recalculateStats(updated);
                return updated;
            });
        }
    }, [id, recalculateStats]);

    useWebSocketEvent(['invoice:deleted'], (data: any) => {
        const invoiceId = data?.id || data?.invoice_id;
        setDocuments(prev => {
            const updated = prev.filter(doc => doc.id !== invoiceId);
            recalculateStats(updated);
            return updated;
        });
    }, [recalculateStats]);

    // Gestion dynamique des paiements (met à jour le statut de la facture)
    useWebSocketEvent(['payment:created'], (payment: any) => {
        // Le paiement inclut souvent la facture mise à jour, sinon on attend invoice:updated
        if (payment.invoice?.client_id === id) {
            const invoice = payment.invoice;
            setDocuments(prev => {
                const updated = prev.map(doc => 
                    doc.id === invoice.id 
                        ? { ...doc, status: invoice.status, amount: invoice.total }
                        : doc
                );
                recalculateStats(updated);
                return updated;
            });
        }
    }, [id, recalculateStats]);

    // Gestion dynamique des devis
    useWebSocketEvent(['quote:created'], (quote: any) => {
        if (quote.client_id === id) {
            const newDoc: Document = {
                id: quote.id,
                number: quote.quote_number,
                type: 'quote',
                date: quote.issue_date,
                amount: quote.total,
                status: quote.status,
            };
            setDocuments(prev => {
                const updated = [newDoc, ...prev].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                recalculateStats(updated);
                return updated;
            });
        }
    }, [id, recalculateStats]);

    useWebSocketEvent(['quote:updated', 'quote:status_changed', 'quote:signed'], (quote: any) => {
        if (quote.client_id === id) {
            setDocuments(prev => {
                const updated = prev.map(doc => 
                    doc.id === quote.id 
                        ? {
                            ...doc,
                            number: quote.quote_number,
                            amount: quote.total,
                            status: quote.status,
                            date: quote.issue_date,
                        }
                        : doc
                );
                recalculateStats(updated);
                return updated;
            });
        }
    }, [id, recalculateStats]);

    useWebSocketEvent(['quote:deleted'], (data: any) => {
        const quoteId = data?.id || data?.quote_id;
        setDocuments(prev => {
            const updated = prev.filter(doc => doc.id !== quoteId);
            recalculateStats(updated);
            return updated;
        });
    }, [recalculateStats]);

    const handleDelete = async () => {
        if (!currentCompany || !client) return;
        try {
            await clientService.delete(currentCompany.id, client.id);
            toast({
                title: 'Client supprimé',
                description: 'Le client a été supprimé avec succès',
            });
            navigate('/clients');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer le client',
            });
        }
        setDeleteDialogOpen(false);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR');
    };

    const getStatusLabel = (doc: Document) => {
        if (doc.type === 'quote') {
            return quoteStatusLabels[doc.status] || doc.status;
        }
        return invoiceStatusLabels[doc.status] || doc.status;
    };

    // Filter documents
    const filteredDocuments = documents.filter(doc => {
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
        if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
        return true;
    });

    // Get all invoices for the modal
    const billingDocuments = documents.filter(doc => doc.type === 'invoice' || doc.type === 'credit_note');
    const totalInvoicesPages = Math.ceil(billingDocuments.length / ITEMS_PER_PAGE);
    const paginatedInvoices = billingDocuments.slice(
        (modalPage - 1) * ITEMS_PER_PAGE,
        modalPage * ITEMS_PER_PAGE
    );

    // Sort reminders
    const sortedReminders = [...reminders].sort((a, b) => {
        const dateA = new Date(a.scheduled_at).getTime();
        const dateB = new Date(b.scheduled_at).getTime();
        return reminderSort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64 lg:col-span-2" />
                </div>
            </div>
        );
    }

    if (!client) return null;

    const displayName = client.company_name || `${client.first_name || ''} ${client.last_name || ''}`.trim();

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            {client.client_sector === 'public' ? (
                                <Landmark className="h-7 w-7 text-primary" />
                            ) : client.type === 'professional' ? (
                                <Building2 className="h-7 w-7 text-primary" />
                            ) : (
                                <User className="h-7 w-7 text-primary" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="min-w-0 break-words text-2xl font-bold">{displayName}</h1>
                                <Badge variant={client.type === 'professional' ? 'default' : 'secondary'} className="shrink-0">
                                    {client.client_sector === 'public' ? 'Public' : client.type === 'professional' ? 'Pro' : 'Particulier'}
                                </Badge>
                                {client.chorus_pro_eligibility_status === 'eligible' && (
                                    <Badge className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Chorus Pro
                                    </Badge>
                                )}
                            </div>
                            {client.type === 'professional' && (
                                <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                                    {client.siret && <p>SIRET : {client.siret}</p>}
                                    {client.siren && <p>SIREN : {client.siren}</p>}
                                    {client.vat_number && <p>TVA : {client.vat_number}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto" asChild>
                        <Link to={`/quotes/new?client=${client.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            Créer un devis
                        </Link>
                    </Button>
                    <Button className="w-full sm:w-auto" asChild>
                        <Link to={`/invoices/new?client=${client.id}`}>
                            <Receipt className="mr-2 h-4 w-4" />
                            Créer une facture
                        </Link>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="w-full sm:w-10">
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}/edit`)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Statistiques */}
            {stats && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">Total facturé</p>
                                    <p className="text-2xl font-bold">{formatCurrency(stats.total_invoiced)}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                    <Receipt className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">En attente</p>
                                    <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.total_pending)}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                                    <Clock className="h-5 w-5 text-yellow-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">En retard</p>
                                    <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.total_overdue)}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">Documents</p>
                                    <p className="text-2xl font-bold">{stats.documents_count}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Section Chorus Pro (clients publics uniquement) */}
            {client.client_sector === 'public' && (
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Landmark className="h-5 w-5" />
                                Chorus Pro
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleVerifyChorus}
                                disabled={chorusVerifying || (!client.siret && !client.siren)}
                            >
                                {chorusVerifying ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                {client.chorus_pro_eligibility_status === 'unchecked' ? 'Vérifier' : 'Revérifier'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Badge éligibilité */}
                        <div className="flex flex-wrap items-center gap-3">
                            {client.chorus_pro_eligibility_status === 'eligible' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Compatible Chorus Pro
                                </Badge>
                            ) : client.chorus_pro_eligibility_status === 'ineligible' ? (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                    <XCircle className="mr-1 h-3.5 w-3.5" />
                                    Non reconnu comme destinataire Chorus
                                </Badge>
                            ) : client.chorus_pro_eligibility_status === 'error' ? (
                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                                    <AlertCircle className="mr-1 h-3.5 w-3.5" />
                                    Erreur de vérification
                                </Badge>
                            ) : (
                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                                    <HelpCircle className="mr-1 h-3.5 w-3.5" />
                                    À vérifier
                                </Badge>
                            )}
                        </div>

                        {/* Détails si éligible */}
                        {client.chorus_pro_eligibility_status === 'eligible' && (
                            <div className="space-y-2 text-sm">
                                {client.chorus_pro_structure_label && (
                                    <div>
                                        <span className="text-muted-foreground">Structure : </span>
                                        <span className="font-medium">{client.chorus_pro_structure_label}</span>
                                    </div>
                                )}
                                {client.chorus_pro_code_destinataire && (
                                    <div>
                                        <span className="text-muted-foreground">Code destinataire : </span>
                                        <span className="font-mono">{client.chorus_pro_code_destinataire}</span>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {client.chorus_pro_service_code_required && (
                                        <Badge variant="outline" className="text-xs">Code service requis</Badge>
                                    )}
                                    {client.chorus_pro_engagement_required && (
                                        <Badge variant="outline" className="text-xs">N° engagement requis</Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Date de dernière vérification */}
                        {client.chorus_pro_last_checked_at && (
                            <p className="text-xs text-muted-foreground">
                                Dernière vérification : {new Date(client.chorus_pro_last_checked_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}

                        {/* Message si pas de SIRET/SIREN */}
                        {!client.siret && !client.siren && (
                            <p className="text-xs text-muted-foreground">
                                Ajoutez un SIRET ou SIREN pour vérifier l'éligibilité Chorus Pro.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
                {/* Informations de contact */}
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle>Informations de contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {client.email && (
                            <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                                    <a href={`mailto:${client.email}`} className="break-words text-primary hover:underline">
                                        {client.email}
                                    </a>
                                </div>
                            </div>
                        )}
                        {client.phone && (
                            <div className="flex items-start gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Téléphone</p>
                                    <a href={`tel:${client.phone}`} className="hover:underline">
                                        {client.phone}
                                    </a>
                                </div>
                            </div>
                        )}
                        {(client.address || client.city) && (
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground">Adresse</p>
                                    <p className="break-words">
                                        {[
                                            client.address,
                                            [client.postal_code, client.city].filter(Boolean).join(' '),
                                            client.country !== 'FR' ? client.country : null
                                        ].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}
                        {client.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm whitespace-pre-line">{client.notes}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Historique des documents */}
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle>Historique des documents</CardTitle>
                            <div className="grid grid-cols-1 gap-2 sm:flex">
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-full sm:w-[140px]">
                                        <Filter className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les types</SelectItem>
                                        <SelectItem value="quote">Devis</SelectItem>
                                        <SelectItem value="invoice">Facture</SelectItem>
                                        <SelectItem value="credit_note">Avoir</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-[140px]">
                                        <Filter className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Statut" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les statuts</SelectItem>
                                        <SelectItem value="draft">Brouillon</SelectItem>
                                        <SelectItem value="sent">Envoyé</SelectItem>
                                        <SelectItem value="accepted">Accepté</SelectItem>
                                        <SelectItem value="paid">Payé</SelectItem>
                                        <SelectItem value="overdue">En retard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredDocuments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">Aucun document trouvé</p>
                            </div>
                        ) : (
                            <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Numéro</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                        <TableHead>Statut</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDocuments.map((doc) => (
                                        <TableRow 
                                            key={`${doc.type}-${doc.id}`}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => navigate(
                                                doc.type === 'quote'
                                                    ? `/quotes/${doc.id}`
                                                    : doc.type === 'credit_note'
                                                        ? `/credit-notes/${doc.id}`
                                                        : `/invoices/${doc.id}`,
                                            )}
                                        >
                                            <TableCell className="font-medium text-primary">
                                                {doc.number}
                                            </TableCell>
                                            <TableCell>{documentTypeLabels[doc.type]}</TableCell>
                                            <TableCell>{formatDate(doc.date)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(doc.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColors[doc.status] || 'bg-gray-100 text-gray-800'}>
                                                    {getStatusLabel(doc)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        
                        {/* Bouton centré en bas */}
                        {billingDocuments.length > 0 && (
                            <div className="flex justify-center border-t px-4 py-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        setModalPage(1);
                                        setInvoicesModalOpen(true);
                                    }}
                                >
                                    <List className="mr-2 h-4 w-4" />
                                    Voir toutes les factures et avoirs ({billingDocuments.length})
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Historique des relances */}
            <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Historique des relances
                        </CardTitle>
                        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                            <Select value={reminderSort} onValueChange={(v) => setReminderSort(v as 'desc' | 'asc')}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">Date décroissante</SelectItem>
                                    <SelectItem value="asc">Date croissante</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {sortedReminders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">Aucune relance pour ce client</p>
                        </div>
                    ) : (
                        <Table className="min-w-[560px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Facture concernée</TableHead>
                                    <TableHead>Statut</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedReminders.map((reminder) => (
                                    <TableRow key={reminder.id}>
                                        <TableCell>{formatDate(reminder.scheduled_at)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                reminder.type === 'after_due' || reminder.type === 'before_due'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                            }>
                                                {reminderTypeLabels[reminder.type] || 'Manuelle'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {reminder.invoice_id ? (
                                                <Link 
                                                    to={`/invoices/${reminder.invoice_id}`}
                                                    className="text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Voir la facture
                                                </Link>
                                            ) : reminder.quote_id ? (
                                                <Link 
                                                    to={`/quotes/${reminder.quote_id}`}
                                                    className="text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Voir le devis
                                                </Link>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                reminder.status === 'sent' ? 'bg-green-100 text-green-800' :
                                                reminder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                reminder.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }>
                                                {reminderStatusLabels[reminder.status] || reminder.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal pour afficher toutes les factures */}
            <Dialog open={invoicesModalOpen} onOpenChange={setInvoicesModalOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Factures et avoirs ({billingDocuments.length})
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                        {billingDocuments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">Aucun document de facturation pour ce client</p>
                            </div>
                        ) : (
                            <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Numéro</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                        <TableHead>Statut</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedInvoices.map((doc) => (
                                        <TableRow 
                                            key={`modal-${doc.type}-${doc.id}`}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => {
                                                setInvoicesModalOpen(false);
                                                navigate(doc.type === 'credit_note' ? `/credit-notes/${doc.id}` : `/invoices/${doc.id}`);
                                            }}
                                        >
                                            <TableCell className="font-medium text-primary">
                                                {doc.number}
                                            </TableCell>
                                            <TableCell>{documentTypeLabels[doc.type]}</TableCell>
                                            <TableCell>{formatDate(doc.date)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(doc.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColors[doc.status] || 'bg-gray-100 text-gray-800'}>
                                                    {getStatusLabel(doc)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    
                    {/* Pagination */}
                    {totalInvoicesPages > 1 && (
                        <div className="flex items-center justify-between border-t pt-4 mt-4">
                            <p className="text-sm text-muted-foreground">
                                Page {modalPage} sur {totalInvoicesPages} • {billingDocuments.length} document{billingDocuments.length > 1 ? 's' : ''}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                                    disabled={modalPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Précédent
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalInvoicesPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalInvoicesPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (modalPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (modalPage >= totalInvoicesPages - 2) {
                                            pageNum = totalInvoicesPages - 4 + i;
                                        } else {
                                            pageNum = modalPage - 2 + i;
                                        }
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={modalPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                className="w-8 h-8 p-0"
                                                onClick={() => setModalPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setModalPage(p => Math.min(totalInvoicesPages, p + 1))}
                                    disabled={modalPage === totalInvoicesPages}
                                >
                                    Suivant
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmation de suppression */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Toutes les données associées à ce client seront conservées 
                            mais le client ne sera plus accessible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
