import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FileText, Plus, Search, Filter, MoreHorizontal, 
    Eye, Edit, Copy, Trash2, Send, FileCheck, Download,
    ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { legalService, quoteService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import type { Quote, QuoteStatus, QuoteQueryParams } from '@/types';

const statusLabels: Record<QuoteStatus, string> = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    viewed: 'Consulté',
    accepted: 'Accepté',
    signed: 'Signé',
    refused: 'Refusé',
    expired: 'Expiré',
    converted: 'Converti',
};

const statusColors: Record<QuoteStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    viewed: 'bg-cyan-100 text-cyan-800',
    accepted: 'bg-green-100 text-green-800',
    signed: 'bg-indigo-100 text-indigo-800',
    refused: 'bg-red-100 text-red-800',
    expired: 'bg-orange-100 text-orange-800',
    converted: 'bg-purple-100 text-purple-800',
};

export function QuotesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const { isReadOnly } = useSubscription();
    
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Filtres
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

    // Dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [convertDialogOpen, setConvertDialogOpen] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [cgvAccepted, setCgvAccepted] = useState(false);
    const [hasPublishedCompanyTerms, setHasPublishedCompanyTerms] = useState(false);

    const fetchQuotes = async () => {
        if (!currentCompany) return;
        
        setLoading(true);
        try {
            const params: QuoteQueryParams = {
                page,
                limit: 10,
            };
            if (search) params.search = search;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await quoteService.getAll(currentCompany.id, params);
            setQuotes(response.quotes);
            setTotal(response.total);
            setTotalPages(response.totalPages);
        } catch (error: any) {
            console.error('Error fetching quotes:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger les devis',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotes();
    }, [currentCompany, page, statusFilter]);

    useEffect(() => {
        const loadCompanySalesTerms = async () => {
            if (!currentCompany) {
                setHasPublishedCompanyTerms(false);
                return;
            }

            try {
                const legalDocuments = await legalService.getCompanyDocuments(currentCompany.id);
                const publishedSalesTerms = legalDocuments.documents
                    .find((document) => document.document_type === 'sales_terms')
                    ?.published_version?.content_text
                    ?.trim();

                setHasPublishedCompanyTerms(Boolean(publishedSalesTerms || currentCompany.terms_and_conditions?.trim()));
            } catch {
                setHasPublishedCompanyTerms(Boolean(currentCompany.terms_and_conditions?.trim()));
            }
        };

        loadCompanySalesTerms();
    }, [currentCompany]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (page === 1) {
                fetchQuotes();
            } else {
                setPage(1);
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    // Écouter les événements WebSocket pour les devis
    useWebSocketEvent<Quote>('quote:created', (newQuote) => {
        if (currentCompany && newQuote.company_id === currentCompany.id) {
            setQuotes(prev => [newQuote, ...prev]);
            setTotal(prev => prev + 1);
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<Quote>(['quote:updated', 'quote:status_changed', 'quote:signed'], (updatedQuote) => {
        setQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
    }, []);

    useWebSocketEvent<{ id: string }>('quote:deleted', ({ id }) => {
        setQuotes(prev => prev.filter(q => q.id !== id));
        setTotal(prev => Math.max(0, prev - 1));
    }, []);

    const handleDuplicate = async (quoteId: string) => {
        if (!currentCompany) return;
        try {
            const newQuote = await quoteService.duplicate(currentCompany.id, quoteId);
            toast({
                title: 'Devis dupliqué',
                description: `Le devis ${newQuote.quote_number} a été créé`,
            });
            fetchQuotes();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de dupliquer le devis',
            });
        }
    };

    const handleDelete = async (quoteId: string) => {
        if (!currentCompany) return;
        try {
            await quoteService.delete(currentCompany.id, quoteId);
            toast({
                title: 'Devis supprimé',
                description: 'Le devis a été supprimé avec succès',
            });
            fetchQuotes();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer le devis',
            });
        }
    };

    const handleSend = async (quoteId: string) => {
        if (!currentCompany) return;
        const selectedQuote = quotes.find((quote) => quote.id === quoteId);
        const requiresNoTermsConfirmation =
            !selectedQuote?.terms_and_conditions?.trim() && !hasPublishedCompanyTerms;
        try {
            const response = await quoteService.send(currentCompany.id, quoteId, {
                confirm_send_without_cgv: requiresNoTermsConfirmation || undefined,
            });
            toast({
                title: 'Devis envoyé',
                description: 'Le devis a été envoyé au client',
            });
            if (response.warnings?.length) {
                response.warnings.forEach((w: string) => toast({ title: 'Avertissement', description: w }));
            }
            fetchQuotes();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'envoyer le devis',
            });
        }
    };

    const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId) || null;
    const selectedQuoteHasTerms = Boolean(selectedQuote?.terms_and_conditions?.trim());
    const requiresTermsConfirmation = selectedQuoteHasTerms;
    const requiresNoTermsConfirmation = !selectedQuoteHasTerms && !hasPublishedCompanyTerms;

    const handleConvert = async (quoteId: string) => {
        if (!currentCompany) return;
        try {
            const invoice = await quoteService.convert(currentCompany.id, quoteId);
            toast({
                title: 'Facture créée',
                description: `La facture ${invoice.invoice_number} a été créée`,
            });
            navigate(`/invoices/${invoice.id}`);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de convertir le devis',
            });
        }
    };

    const handleDownloadPdf = async (quoteId: string, quoteNumber: string) => {
        if (!currentCompany) return;
        try {
            const blob = await quoteService.downloadPdf(currentCompany.id, quoteId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quoteNumber}.pdf`;
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
                    <h1 className="text-2xl font-bold">Devis</h1>
                    <p className="text-muted-foreground">
                        {total} devis au total
                    </p>
                </div>
                {permissions.canCreateQuote && (
                    <Button
                        onClick={() => navigate('/quotes/new')}
                        disabled={isReadOnly}
                        title={isReadOnly ? 'Abonnement requis' : undefined}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouveau devis
                    </Button>
                )}
            </div>

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
                            onValueChange={(value) => setStatusFilter(value as QuoteStatus | 'all')}
                        >
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les statuts</SelectItem>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={fetchQuotes}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table des devis */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : quotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mb-2 text-lg font-medium">Aucun devis</h3>
                            <p className="mb-4 text-muted-foreground">
                                {search || statusFilter !== 'all'
                                    ? 'Aucun devis ne correspond à vos critères'
                                    : 'Vous n\'avez pas encore créé de devis'}
                            </p>
                            {!search && statusFilter === 'all' && permissions.canCreateQuote && (
                                <Button onClick={() => navigate('/quotes/new')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Créer votre premier devis
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
                                    <TableHead>Validité</TableHead>
                                    <TableHead>Montant TTC</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotes.map((quote) => (
                                    <TableRow 
                                        key={quote.id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/quotes/${quote.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {quote.quote_number}
                                        </TableCell>
                                        <TableCell>
                                            {quote.client?.company_name || 
                                             `${quote.client?.first_name || ''} ${quote.client?.last_name || ''}`.trim() ||
                                             '-'}
                                        </TableCell>
                                        <TableCell>{formatDate(quote.issue_date)}</TableCell>
                                        <TableCell>{formatDate(quote.validity_date)}</TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(quote.total)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={statusColors[quote.status]}>
                                                {statusLabels[quote.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}`)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Voir
                                                    </DropdownMenuItem>
                                                    {quote.status === 'draft' && permissions.canEditQuote && (
                                                        <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}/edit`)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Modifier
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleDownloadPdf(quote.id, quote.quote_number)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Télécharger PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {quote.status === 'draft' && permissions.canSendQuote && (
                                                        <DropdownMenuItem onClick={() => { setSelectedQuoteId(quote.id); setSendDialogOpen(true); }}>
                                                            <Send className="mr-2 h-4 w-4" />
                                                            Envoyer
                                                        </DropdownMenuItem>
                                                    )}
                                                    {quote.status === 'accepted' && permissions.canCreateInvoice && (
                                                        <DropdownMenuItem onClick={() => { setSelectedQuoteId(quote.id); setConvertDialogOpen(true); }}>
                                                            <FileCheck className="mr-2 h-4 w-4" />
                                                            Convertir en facture
                                                        </DropdownMenuItem>
                                                    )}
                                                    {permissions.canCreateQuote && (
                                                        <DropdownMenuItem onClick={() => handleDuplicate(quote.id)}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            Dupliquer
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    {quote.status === 'draft' && permissions.canDeleteQuote && (
                                                        <DropdownMenuItem
                                                            onClick={() => { setSelectedQuoteId(quote.id); setDeleteDialogOpen(true); }}
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

            {/* Dialog suppression */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => { if (selectedQuoteId) handleDelete(selectedQuoteId); }}
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog envoi */}
            <AlertDialog
                open={sendDialogOpen}
                onOpenChange={(open) => {
                    setSendDialogOpen(open);
                    if (!open) {
                        setCgvAccepted(false);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Envoyer ce devis ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Le devis sera envoyé par email avec son PDF joint et son lien public associé.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {requiresTermsConfirmation && (
                        <div className="py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={cgvAccepted}
                                    onChange={(e) => setCgvAccepted(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">
                                    J&apos;ai vérifié les conditions générales de vente jointes à ce devis
                                </span>
                            </label>
                        </div>
                    )}
                    {!requiresTermsConfirmation && hasPublishedCompanyTerms && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            Les CGV publiées de l’entreprise seront automatiquement attachées à ce devis lors de l’envoi.
                        </div>
                    )}
                    {requiresNoTermsConfirmation && (
                        <div className="space-y-3 py-2">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Aucune CGV n’est disponible. Ce devis sera envoyé sans CGV attachées ni CGV entreprise publiées.
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={cgvAccepted}
                                    onChange={(e) => setCgvAccepted(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">
                                    J&apos;ai vérifié que ce devis sera envoyé sans CGV
                                </span>
                            </label>
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setCgvAccepted(false);
                                if (selectedQuoteId) handleSend(selectedQuoteId);
                            }}
                            disabled={(requiresTermsConfirmation || requiresNoTermsConfirmation) && !cgvAccepted}
                        >
                            Envoyer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog conversion */}
            <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Convertir en facture ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Une facture sera créée. Le devis passera au statut 'Converti'.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (selectedQuoteId) handleConvert(selectedQuoteId); }}>
                            Convertir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
