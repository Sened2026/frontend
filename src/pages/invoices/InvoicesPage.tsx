import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Receipt, Plus, Search, Filter, MoreHorizontal,
    Eye, Edit, Trash2, Send, Download, Ban, CreditCard,
    ChevronLeft, ChevronRight, RefreshCw, TrendingUp,
    Clock, AlertTriangle, CheckCircle, FileDown, FileMinus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
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
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { invoiceService, chorusProService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { invoiceStatusLabels as statusLabels, invoiceStatusColors as statusColors, getChorusStatusLabel, getChorusStatusColor } from '@/lib/invoice-status-config';
import type { Invoice, InvoiceStatus, InvoiceStats, InvoiceQueryParams } from '@/types';

export function InvoicesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const { isReadOnly } = useSubscription();
    
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<InvoiceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Filtres
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

    // Dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [statsBreakdownDialog, setStatsBreakdownDialog] = useState<'invoiced' | 'paid' | null>(null);

    // Chorus Pro
    const [chorusEnabled, setChorusEnabled] = useState(false);
    const [chorusStatuses, setChorusStatuses] = useState<Record<string, string>>({});

    // Active tab
    const [activeTab, setActiveTab] = useState('my-invoices');

    // Received invoices (Chorus Pro)
    const [receivedInvoices, setReceivedInvoices] = useState<any[]>([]);
    const [receivedLoading, setReceivedLoading] = useState(false);
    const [receivedPage, setReceivedPage] = useState(1);
    const [receivedTotal, setReceivedTotal] = useState(0);
    const [receivedTotalPages, setReceivedTotalPages] = useState(1);
    const [receivedDateFrom, setReceivedDateFrom] = useState('');
    const [receivedDateTo, setReceivedDateTo] = useState('');
    const [receivedStatusFilter, setReceivedStatusFilter] = useState('all');

    // Received invoice detail dialog
    const [receivedDetailOpen, setReceivedDetailOpen] = useState(false);
    const [receivedDetail, setReceivedDetail] = useState<any>(null);
    const [receivedDetailLoading, setReceivedDetailLoading] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    const fetchInvoices = async () => {
        if (!currentCompany) return;
        
        setLoading(true);
        try {
            const params: InvoiceQueryParams = {
                page,
                limit: 10,
            };
            if (search) params.search = search;
            if (statusFilter !== 'all') params.status = statusFilter;

            const [invoicesResponse, statsResponse] = await Promise.all([
                invoiceService.getAll(currentCompany.id, params),
                invoiceService.getStats(currentCompany.id),
            ]);

            setInvoices(invoicesResponse.invoices);
            setTotal(invoicesResponse.total);
            setTotalPages(invoicesResponse.totalPages);
            setStats(statsResponse);
        } catch (error: any) {
            console.error('Error fetching invoices:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger les factures',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, [currentCompany, page, statusFilter]);

    // Check if Chorus Pro is enabled for this company
    useEffect(() => {
        if (!currentCompany) return;
        chorusProService.getSettings(currentCompany.id).then((settings) => {
            setChorusEnabled(!!settings?.enabled);
        }).catch(() => {});
    }, [currentCompany?.id]);

    // Load Chorus Pro statuses for displayed invoices
    useEffect(() => {
        if (!chorusEnabled || invoices.length === 0) return;
        const loadStatuses = async () => {
            const statuses: Record<string, string> = {};
            await Promise.allSettled(
                invoices
                    .filter((inv) => !['draft', 'cancelled'].includes(inv.status))
                    .map(async (inv) => {
                        try {
                            const sub = await chorusProService.getSubmissionStatus(inv.id);
                            if (sub?.statut_chorus) {
                                statuses[inv.id] = sub.statut_chorus;
                            }
                        } catch {}
                    }),
            );
            setChorusStatuses(statuses);
        };
        loadStatuses();
    }, [chorusEnabled, invoices]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (page === 1) {
                fetchInvoices();
            } else {
                setPage(1);
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    // Écouter les événements WebSocket pour les factures
    useWebSocketEvent<Invoice>('invoice:created', (newInvoice) => {
        if (currentCompany && newInvoice.company_id === currentCompany.id) {
            setInvoices(prev => [newInvoice, ...prev]);
            setTotal(prev => prev + 1);
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<Invoice>(['invoice:updated', 'invoice:status_changed'], (updatedInvoice) => {
        setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
    }, []);

    useWebSocketEvent<{ id: string }>('invoice:deleted', ({ id }) => {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
        setTotal(prev => Math.max(0, prev - 1));
    }, []);

    // Rafraîchir les stats quand une facture change
    useWebSocketEvent(['invoice:created', 'invoice:updated', 'invoice:status_changed', 'invoice:deleted', 'payment:created'], () => {
        if (currentCompany) {
            invoiceService.getStats(currentCompany.id).then(setStats).catch(console.error);
        }
    }, [currentCompany?.id]);

    const handleDelete = async (invoiceId: string) => {
        if (!currentCompany) return;
        try {
            await invoiceService.delete(currentCompany.id, invoiceId);
            toast({
                title: 'Facture supprimée',
                description: 'La facture a été supprimée avec succès',
            });
            fetchInvoices();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer la facture',
            });
        }
    };

    const handleSend = async (invoiceId: string) => {
        if (!currentCompany) return;
        try {
            const response = await invoiceService.send(currentCompany.id, invoiceId);
            toast({
                title: 'Facture envoyée',
                description: 'La facture a été envoyée au client',
            });
            if (response.warnings?.length) {
                response.warnings.forEach((w: string) => toast({ title: 'Avertissement', description: w }));
            }
            fetchInvoices();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'envoyer la facture',
            });
        }
    };

    const handleCancel = async (invoiceId: string) => {
        if (!currentCompany) return;
        const reason = prompt('Raison de l\'annulation :');
        if (!reason) return;
        
        try {
            await invoiceService.cancel(currentCompany.id, invoiceId, { reason });
            toast({
                title: 'Facture annulée',
                description: 'La facture a été annulée',
            });
            fetchInvoices();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'annuler la facture',
            });
        }
    };

    const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
        if (!currentCompany) return;
        try {
            const blob = await invoiceService.downloadPdf(currentCompany.id, invoiceId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoiceNumber}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de télécharger le PDF',
            });
        }
    };

    const activeBreakdown = stats && statsBreakdownDialog
        ? (statsBreakdownDialog === 'invoiced'
            ? stats.total_invoiced_breakdown
            : stats.total_paid_breakdown)
        : null;

    // ─── Received Invoices (Chorus Pro) ─────────────────
    const fetchReceivedInvoices = async () => {
        if (!currentCompany || !chorusEnabled) return;
        setReceivedLoading(true);
        try {
            const params: Record<string, any> = {
                nbResultatsParPage: 10,
                pageResultatDemandee: receivedPage,
            };
            if (receivedDateFrom) params.dateHeureDepotFactureDebut = receivedDateFrom;
            if (receivedDateTo) params.dateHeureDepotFactureFin = receivedDateTo;
            if (receivedStatusFilter !== 'all') params.statutFacture = receivedStatusFilter;

            const result = await chorusProService.searchReceivedInvoices(currentCompany.id, params);
            const factures = result?.listeFactures || [];
            setReceivedInvoices(factures);
            setReceivedTotal(result?.nbResultatsTotal || 0);
            setReceivedTotalPages(Math.ceil((result?.nbResultatsTotal || 0) / 10));
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger les factures reçues',
            });
        } finally {
            setReceivedLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'received' && chorusEnabled) {
            fetchReceivedInvoices();
        }
    }, [activeTab, chorusEnabled, receivedPage, currentCompany?.id]);

    const handleViewReceivedDetail = async (idFacture: number) => {
        if (!currentCompany) return;
        setReceivedDetailOpen(true);
        setReceivedDetailLoading(true);
        try {
            const detail = await chorusProService.getReceivedInvoiceDetail(currentCompany.id, idFacture);
            setReceivedDetail(detail);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger le détail',
            });
            setReceivedDetailOpen(false);
        } finally {
            setReceivedDetailLoading(false);
        }
    };

    const handleDownloadReceivedPdf = async (idFacture: number) => {
        if (!currentCompany) return;
        setDownloadingPdf(true);
        try {
            const result = await chorusProService.downloadInvoices(currentCompany.id, [idFacture], 'PDF');
            if (result?.pieceJointe) {
                const byteCharacters = atob(result.pieceJointe);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chorus-${idFacture}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                toast({ title: 'PDF non disponible', description: 'Le fichier PDF n\'est pas disponible pour cette facture.' });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de télécharger le PDF',
            });
        } finally {
            setDownloadingPdf(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR');
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            {/* En-tête */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold">Factures</h1>
                    <p className="text-muted-foreground">
                        {total} factures au total
                    </p>
                </div>
                {permissions.canCreateInvoice && (
                    <Button
                        onClick={() => navigate('/invoices/new')}
                        disabled={isReadOnly}
                        title={isReadOnly ? 'Abonnement requis' : undefined}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouvelle facture
                    </Button>
                )}
            </div>

            {/* Onglets si Chorus Pro activé */}
            {chorusEnabled ? (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="my-invoices">Mes factures</TabsTrigger>
                        <TabsTrigger value="received">Reçues (Chorus)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="my-invoices" className="space-y-6 mt-4">
                        {renderMyInvoicesContent()}
                    </TabsContent>

                    <TabsContent value="received" className="space-y-6 mt-4">
                        {renderReceivedInvoicesContent()}
                    </TabsContent>
                </Tabs>
            ) : (
                <div className="space-y-6">
                    {renderMyInvoicesContent()}
                </div>
            )}

            {/* Dialogs */}
            {renderDialogs()}
        </div>
    );

    function renderMyInvoicesContent() {
        return (
            <>

            {/* Statistiques */}
            {stats && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card
                        className="cursor-pointer transition-colors hover:bg-muted/20"
                        onClick={() => setStatsBreakdownDialog('invoiced')}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total facturé</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.total_invoiced)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Voir le détail du calcul</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="cursor-pointer transition-colors hover:bg-muted/20"
                        onClick={() => setStatsBreakdownDialog('paid')}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Encaissé</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_paid)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Voir le détail du calcul</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">En attente</CardTitle>
                            <Clock className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.total_pending)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">En retard</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.total_overdue)}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filtres */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par numéro, client..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}
                        >
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les statuts</SelectItem>
                                {Object.entries(statusLabels)
                                    .filter(([value]) => !(
                                        permissions.isMerchantContext &&
                                        permissions.isAccountantSide &&
                                        value === 'draft'
                                    ))
                                    .map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={fetchInvoices}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table des factures */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Receipt className="mb-4 h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mb-2 text-lg font-medium">Aucune facture</h3>
                            <p className="mb-4 text-muted-foreground">
                                {search || statusFilter !== 'all'
                                    ? 'Aucune facture ne correspond à vos critères'
                                    : 'Vous n\'avez pas encore créé de facture'}
                            </p>
                            {!search && statusFilter === 'all' && permissions.canCreateInvoice && (
                                <Button onClick={() => navigate('/invoices/new')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Créer votre première facture
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Numéro</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Échéance</TableHead>
                                    <TableHead>Montant TTC</TableHead>
                                    <TableHead>Payé</TableHead>
                                    <TableHead>Statut</TableHead>
                                    {chorusEnabled && <TableHead>Chorus Pro</TableHead>}
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices
                                .filter(inv => !(
                                    permissions.isMerchantContext &&
                                    permissions.isAccountantSide &&
                                    inv.status === 'draft'
                                ))
                                .map((invoice) => (
                                    <TableRow 
                                        key={invoice.id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {invoice.invoice_number}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.client?.company_name || 
                                             `${invoice.client?.first_name || ''} ${invoice.client?.last_name || ''}`.trim() ||
                                             '-'}
                                        </TableCell>
                                        <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(invoice.total)}
                                        </TableCell>
                                        <TableCell>
                                            {formatCurrency(invoice.amount_paid)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={statusColors[invoice.status]}>
                                                {statusLabels[invoice.status]}
                                            </Badge>
                                        </TableCell>
                                        {chorusEnabled && (
                                            <TableCell>
                                                {chorusStatuses[invoice.id] ? (
                                                    <Badge className={getChorusStatusColor(chorusStatuses[invoice.id])}>
                                                        {getChorusStatusLabel(chorusStatuses[invoice.id])}
                                                    </Badge>
                                                ) : null}
                                            </TableCell>
                                        )}
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Voir
                                                    </DropdownMenuItem>
                                                    {invoice.status === 'draft' && permissions.canEditInvoice && (
                                                        <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Modifier
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Télécharger PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {['draft', 'sent'].includes(invoice.status) && permissions.canSendInvoice && (
                                                        <DropdownMenuItem onClick={() => { setSelectedInvoiceId(invoice.id); setSendDialogOpen(true); }}>
                                                            <Send className="mr-2 h-4 w-4" />
                                                            {invoice.status === 'draft' ? 'Envoyer' : 'Renvoyer'}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {['sent', 'overdue'].includes(invoice.status) && permissions.canEditInvoice && (
                                                        <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/payment`)}>
                                                            <CreditCard className="mr-2 h-4 w-4" />
                                                            Enregistrer un paiement
                                                        </DropdownMenuItem>
                                                    )}
                                                    {['sent', 'overdue'].includes(invoice.status) && permissions.canDeleteInvoice && (
                                                        <DropdownMenuItem onClick={() => handleCancel(invoice.id)}>
                                                            <Ban className="mr-2 h-4 w-4" />
                                                            Annuler
                                                        </DropdownMenuItem>
                                                    )}
                                                    {invoice.status === 'paid' && permissions.canCreateCreditNote && !invoice.has_credit_note && (
                                                        <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}?action=credit-note`)}>
                                                            <FileMinus className="mr-2 h-4 w-4" />
                                                            Créer un avoir
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    {invoice.status === 'draft' && permissions.canDeleteInvoice && (
                                                        <DropdownMenuItem
                                                            onClick={() => { setSelectedInvoiceId(invoice.id); setDeleteDialogOpen(true); }}
                                                            className="text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Supprimer
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {page} sur {totalPages}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Précédent
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Suivant
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            </>
        );
    }

    function renderReceivedInvoicesContent() {
        return (
            <>
                {/* Filtres reçues */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="space-y-1 flex-1">
                                <label className="text-xs text-muted-foreground">Date début</label>
                                <Input
                                    type="date"
                                    value={receivedDateFrom}
                                    onChange={(e) => setReceivedDateFrom(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1 flex-1">
                                <label className="text-xs text-muted-foreground">Date fin</label>
                                <Input
                                    type="date"
                                    value={receivedDateTo}
                                    onChange={(e) => setReceivedDateTo(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Statut Chorus</label>
                                <Select
                                    value={receivedStatusFilter}
                                    onValueChange={setReceivedStatusFilter}
                                >
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <Filter className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Statut" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les statuts</SelectItem>
                                        <SelectItem value="DEPOSEE">Déposée</SelectItem>
                                        <SelectItem value="MISE_A_DISPOSITION">Mise à disposition</SelectItem>
                                        <SelectItem value="SUSPENDUE">Suspendue</SelectItem>
                                        <SelectItem value="REJETEE">Rejetée</SelectItem>
                                        <SelectItem value="MANDATEE">Mandatée</SelectItem>
                                        <SelectItem value="MISE_EN_PAIEMENT">Mise en paiement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button onClick={fetchReceivedInvoices}>
                                    <Search className="mr-2 h-4 w-4" />
                                    Rechercher
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table des factures reçues */}
                <Card>
                    <CardContent className="p-0">
                        {receivedLoading ? (
                            <div className="p-6 space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : receivedInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Receipt className="mb-4 h-12 w-12 text-muted-foreground/50" />
                                <h3 className="mb-2 text-lg font-medium">Aucune facture reçue</h3>
                                <p className="text-muted-foreground">
                                    Aucune facture reçue via Chorus Pro ne correspond à vos critères.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>N° Facture</TableHead>
                                        <TableHead>Fournisseur</TableHead>
                                        <TableHead>Date dépôt</TableHead>
                                        <TableHead>Montant TTC</TableHead>
                                        <TableHead>Statut</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receivedInvoices.map((facture: any) => (
                                        <TableRow
                                            key={facture.identifiantFactureCPP}
                                            className="cursor-pointer"
                                            onClick={() => handleViewReceivedDetail(facture.identifiantFactureCPP)}
                                        >
                                            <TableCell className="font-medium font-mono">
                                                {facture.numeroFacture || facture.identifiantFactureCPP}
                                            </TableCell>
                                            <TableCell>
                                                {facture.designationFournisseur || facture.identifiantFournisseur || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {facture.dateDepot ? formatDate(facture.dateDepot) : '-'}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {facture.montantTTC != null ? formatCurrency(facture.montantTTC) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getChorusStatusColor(facture.statutFacture || '')}>
                                                    {getChorusStatusLabel(facture.statutFacture || '')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDownloadReceivedPdf(facture.identifiantFactureCPP)}
                                                    title="Télécharger PDF"
                                                >
                                                    <FileDown className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination reçues */}
                {receivedTotalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Page {receivedPage} sur {receivedTotalPages} ({receivedTotal} résultats)
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReceivedPage(p => Math.max(1, p - 1))}
                                disabled={receivedPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Précédent
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReceivedPage(p => Math.min(receivedTotalPages, p + 1))}
                                disabled={receivedPage === receivedTotalPages}
                            >
                                Suivant
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    function renderDialogs() {
        return (
            <>
                {/* Dialog suppression */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => { if (selectedInvoiceId) handleDelete(selectedInvoiceId); }}
                            >
                                Supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Dialog envoi */}
                <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Envoyer cette facture ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                La facture sera envoyée par email au client.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { if (selectedInvoiceId) handleSend(selectedInvoiceId); }}>
                                Envoyer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={statsBreakdownDialog !== null} onOpenChange={(open) => !open && setStatsBreakdownDialog(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {statsBreakdownDialog === 'invoiced' ? 'Détail du total facturé' : 'Détail de l’encaissé'}
                            </DialogTitle>
                        </DialogHeader>
                        {activeBreakdown && (
                            <div className="space-y-4 py-2">
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Base retenue</span>
                                        <span className="font-medium">{formatCurrency(activeBreakdown.base_amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Annulations déduites</span>
                                        <span className="font-medium text-red-600">-{formatCurrency(activeBreakdown.cancelled_deduction)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Corrections par avoirs</span>
                                        <span className="font-medium text-red-600">-{formatCurrency(activeBreakdown.credit_notes_correction)}</span>
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Total final</span>
                                    <span className="text-lg font-bold">
                                        {formatCurrency(activeBreakdown.final_amount)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Dialog détail facture reçue Chorus */}
                <Dialog open={receivedDetailOpen} onOpenChange={setReceivedDetailOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Détail facture reçue</DialogTitle>
                        </DialogHeader>
                        {receivedDetailLoading ? (
                            <div className="space-y-4 py-4">
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-6 w-1/2" />
                            </div>
                        ) : receivedDetail ? (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">N° Facture</span>
                                        <p className="font-medium font-mono">{receivedDetail.numeroFacture || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">ID CPP</span>
                                        <p className="font-medium font-mono">{receivedDetail.identifiantFactureCPP || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Fournisseur</span>
                                        <p className="font-medium">{receivedDetail.designationFournisseur || receivedDetail.fournisseur?.designationStructure || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">SIRET Fournisseur</span>
                                        <p className="font-medium font-mono">{receivedDetail.fournisseur?.identifiantStructure || receivedDetail.identifiantFournisseur || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Date dépôt</span>
                                        <p className="font-medium">{receivedDetail.dateDepot ? formatDate(receivedDetail.dateDepot) : '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Date facture</span>
                                        <p className="font-medium">{receivedDetail.dateFacture ? formatDate(receivedDetail.dateFacture) : '-'}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Montant HT</span>
                                        <p className="font-medium">{receivedDetail.montantHT != null ? formatCurrency(receivedDetail.montantHT) : '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">TVA</span>
                                        <p className="font-medium">{receivedDetail.montantTVA != null ? formatCurrency(receivedDetail.montantTVA) : '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Montant TTC</span>
                                        <p className="font-bold">{receivedDetail.montantTTC != null ? formatCurrency(receivedDetail.montantTTC) : '-'}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Statut</span>
                                    <Badge className={getChorusStatusColor(receivedDetail.statutFacture || '')}>
                                        {getChorusStatusLabel(receivedDetail.statutFacture || '')}
                                    </Badge>
                                </div>

                                {receivedDetail.identifiantFactureCPP && (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => handleDownloadReceivedPdf(receivedDetail.identifiantFactureCPP)}
                                        disabled={downloadingPdf}
                                    >
                                        {downloadingPdf ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="mr-2 h-4 w-4" />
                                        )}
                                        Télécharger PDF
                                    </Button>
                                )}
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </>
        );
    }
}
