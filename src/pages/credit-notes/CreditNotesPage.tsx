import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Receipt, Search, MoreHorizontal,
    Eye, Download, RefreshCw, TrendingDown,
    Calendar, Building, FileText, Plus, AlertTriangle
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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { usePermissions } from '@/hooks/usePermissions';
import { invoiceService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import type { Invoice, InvoiceQueryParams } from '@/types';

export function CreditNotesPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);

    const [creditNotes, setCreditNotes] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCreditNotes, setTotalCreditNotes] = useState(0);

    const [search, setSearch] = useState('');

    // Dialog state for credit note creation
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
    const [sentInvoices, setSentInvoices] = useState<Invoice[]>([]);
    const [loadingSentInvoices, setLoadingSentInvoices] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [creditNoteReason, setCreditNoteReason] = useState('');
    const [creditNoteAmount, setCreditNoteAmount] = useState<string>('');
    const [creating, setCreating] = useState(false);

    const fetchCreditNotes = async () => {
        if (!currentCompany) return;
        
        setLoading(true);
        try {
            const params: InvoiceQueryParams = {
                page,
                limit: 10,
                type: 'credit_note',
            };
            if (search) params.search = search;

            const response = await invoiceService.getAll(currentCompany.id, params);

            setCreditNotes(response.invoices);
            setTotal(response.total);
            setTotalPages(response.totalPages);
            
            const totalAmount = response.invoices.reduce((sum: number, cn: Invoice) => sum + Math.abs(cn.total), 0);
            setTotalCreditNotes(totalAmount);
        } catch (error) {
            console.error('Error fetching credit notes:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de charger les avoirs',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCreditNotes();
    }, [currentCompany, page]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (page === 1) {
                fetchCreditNotes();
            } else {
                setPage(1);
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    useWebSocketEvent<Invoice>('invoice:created', (newInvoice) => {
        if (currentCompany && newInvoice.company_id === currentCompany.id && newInvoice.type === 'credit_note') {
            setCreditNotes(prev => [newInvoice, ...prev]);
            setTotal(prev => prev + 1);
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<Invoice>('invoice:updated', (updatedInvoice) => {
        if (updatedInvoice.type === 'credit_note') {
            setCreditNotes(prev => prev.map(cn => cn.id === updatedInvoice.id ? updatedInvoice : cn));
        }
    }, []);

    useWebSocketEvent<{ id: string }>('invoice:deleted', ({ id }) => {
        setCreditNotes(prev => prev.filter(cn => cn.id !== id));
        setTotal(prev => Math.max(0, prev - 1));
    }, []);

    const handleDownloadPdf = async (creditNoteId: string, creditNoteNumber: string) => {
        if (!currentCompany) return;
        try {
            const blob = await invoiceService.downloadPdf(currentCompany.id, creditNoteId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `avoir-${creditNoteNumber}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de télécharger le PDF',
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(amount));
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR');
    };

    const handleOpenCreateDialog = async () => {
        if (!currentCompany) return;
        setCreateDialogOpen(true);
        setSelectedInvoiceId('');
        setCreditNoteReason('');
        setCreditNoteAmount('');
        setLoadingSentInvoices(true);
        try {
            const [sentRes, paidRes, overdueRes] = await Promise.all([
                invoiceService.getAll(currentCompany.id, { status: 'sent', limit: 100 }),
                invoiceService.getAll(currentCompany.id, { status: 'paid', limit: 100 }),
                invoiceService.getAll(currentCompany.id, { status: 'overdue', limit: 100 }),
            ]);
            const merged = [...sentRes.invoices, ...paidRes.invoices, ...overdueRes.invoices];
            const seenIds = new Set<string>();
            setSentInvoices(
                merged.filter((invoice) => {
                    if (invoice.has_credit_note || seenIds.has(invoice.id)) return false;
                    seenIds.add(invoice.id);
                    return true;
                }),
            );
        } catch {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de charger les factures',
            });
        } finally {
            setLoadingSentInvoices(false);
        }
    };

    const handleCreateCreditNote = async () => {
        if (!currentCompany || !selectedInvoiceId || !creditNoteReason.trim()) return;
        setCreating(true);
        try {
            const amount = creditNoteAmount ? parseFloat(creditNoteAmount) : undefined;
            await invoiceService.createCreditNote(currentCompany.id, selectedInvoiceId, { reason: creditNoteReason, amount });
            toast({
                title: 'Avoir créé',
                description: 'L\'avoir a été créé et envoyé au client',
            });
            setCreateDialogOpen(false);
            fetchCreditNotes();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de créer l\'avoir',
            });
        } finally {
            setCreating(false);
        }
    };

    const selectedInvoice = sentInvoices.find(inv => inv.id === selectedInvoiceId);

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold">Avoirs</h1>
                    <p className="text-muted-foreground">
                        {total} avoirs au total
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Vous pouvez créer un avoir intégral ou partiel sur vos factures émises, payées ou en retard
                    </p>
                </div>
                {permissions.canCreateCreditNote && (
                    <Button className="w-full sm:w-auto" onClick={handleOpenCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Créer un avoir
                    </Button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total des avoirs</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalCreditNotes)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nombre d'avoirs</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ce mois</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {creditNotes.filter(cn => {
                                const date = new Date(cn.issue_date);
                                const now = new Date();
                                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                            }).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

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
                        <Button variant="outline" className="w-full sm:w-auto" onClick={fetchCreditNotes}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : creditNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Receipt className="mb-4 h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mb-2 text-lg font-medium">Aucun avoir</h3>
                            <p className="mb-4 text-muted-foreground">
                                {search
                                    ? 'Aucun avoir ne correspond à vos critères'
                                    : 'Vous n\'avez pas encore créé d\'avoir'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Les avoirs sont créés lors de l'annulation d'une facture avec l'option "Créer un avoir".
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Numéro</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Facture d'origine</TableHead>
                                    <TableHead className="text-right">Montant TTC</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {creditNotes.map((creditNote) => (
                                    <TableRow 
                                        key={creditNote.id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/credit-notes/${creditNote.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {creditNote.invoice_number}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Building className="h-4 w-4 text-muted-foreground" />
                                                {creditNote.client?.company_name || 
                                                 `${creditNote.client?.first_name || ''} ${creditNote.client?.last_name || ''}`.trim() ||
                                                 '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatDate(creditNote.issue_date)}</TableCell>
                                        <TableCell>
                                            {creditNote.parent_invoice_id ? (
                                                <Button 
                                                    variant="link" 
                                                    className="h-auto p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/invoices/${creditNote.parent_invoice_id}`);
                                                    }}
                                                >
                                                    Voir la facture
                                                </Button>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            -{formatCurrency(creditNote.total)}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/credit-notes/${creditNote.id}`)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Voir
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadPdf(creditNote.id, creditNote.invoice_number)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Télécharger PDF
                                                    </DropdownMenuItem>
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
                            Précédent
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Suivant
                        </Button>
                    </div>
                </div>
            )}

            {/* Dialog de création d'avoir */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Créer un avoir</DialogTitle>
                        <DialogDescription>
                            Sélectionnez une facture envoyée pour créer un avoir.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-orange-800">
                                <strong>Attention :</strong> la création d'un avoir est irréversible. L'avoir ne pourra plus être modifié ni supprimé une fois créé.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Facture *</Label>
                            {loadingSentInvoices ? (
                                <Skeleton className="h-10 w-full" />
                            ) : sentInvoices.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Aucune facture éligible disponible.
                                </p>
                            ) : (
                                <Select value={selectedInvoiceId} onValueChange={(val) => {
                                    setSelectedInvoiceId(val);
                                    const inv = sentInvoices.find(i => i.id === val);
                                    if (inv) setCreditNoteAmount(Math.abs(inv.total).toFixed(2));
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner une facture..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sentInvoices.map((inv) => (
                                            <SelectItem key={inv.id} value={inv.id}>
                                                {inv.invoice_number} — {inv.client?.company_name || `${inv.client?.first_name || ''} ${inv.client?.last_name || ''}`.trim()} — {formatCurrency(inv.total)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Raison *</Label>
                            <Textarea
                                placeholder="Ex: Erreur de facturation, remboursement client..."
                                value={creditNoteReason}
                                onChange={(e) => setCreditNoteReason(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {selectedInvoice && (
                            <>
                                <div className="space-y-2">
                                    <Label>Montant de l'avoir *</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max={Math.abs(selectedInvoice.total)}
                                            value={creditNoteAmount}
                                            onChange={(e) => setCreditNoteAmount(e.target.value)}
                                            placeholder="Montant"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Maximum : {formatCurrency(selectedInvoice.total)} (montant total de la facture)
                                    </p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-800">
                                        Un avoir de <strong>{creditNoteAmount ? formatCurrency(parseFloat(creditNoteAmount)) : formatCurrency(selectedInvoice.total)}</strong>
                                        {creditNoteAmount && parseFloat(creditNoteAmount) < Math.abs(selectedInvoice.total) ? ' (partiel)' : ''} sera créé pour la facture N° <strong>{selectedInvoice.invoice_number}</strong> et envoyé au client.
                                    </p>
                                </div>
                            </>
                        )}
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => setConfirmCreateOpen(true)}
                            disabled={creating || !selectedInvoiceId || !creditNoteReason.trim()}
                            variant="destructive"
                        >
                            Créer l'avoir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation finale création avoir */}
            <ConfirmationDialog
                open={confirmCreateOpen}
                onConfirm={() => {
                    setConfirmCreateOpen(false);
                    handleCreateCreditNote();
                }}
                onCancel={() => setConfirmCreateOpen(false)}
                title="Créer cet avoir ?"
                description={selectedInvoice
                    ? `Un avoir de ${formatCurrency(creditNoteAmount ? parseFloat(creditNoteAmount) : selectedInvoice.total)}${creditNoteAmount && parseFloat(creditNoteAmount) < Math.abs(selectedInvoice.total) ? ' (partiel)' : ''} sera créé pour la facture N° ${selectedInvoice.invoice_number} et envoyé au client. Cette action est irréversible.`
                    : "L'avoir sera créé et envoyé au client. Cette action est irréversible."}
                confirmLabel="Créer l'avoir"
                variant="destructive"
            />
        </div>
    );
}
