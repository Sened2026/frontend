import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Edit, Send, Download, Ban,
    Clock, CheckCircle, Building,
    Mail, Phone, MapPin, FileText, Euro, Banknote,
    RefreshCw, Bell, Coins, MoreHorizontal, Trash2, FileMinus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { invoiceService, chorusProService, reminderService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { invoiceStatusLabels as statusLabels, invoiceStatusColors as statusColors, invoiceStatusIcons as statusIcons, getChorusStatusLabel, getChorusStatusColor } from '@/lib/invoice-status-config';
import type { Invoice, Payment, Reminder, ChorusProSubmission, ChorusProSettings } from '@/types';
import { groupItemsForReadOnly } from '@/lib/multi-tax-utils';

export function InvoiceDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [markingPaid, setMarkingPaid] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    
    // Dialogs
    const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
    const [reminderLevel, setReminderLevel] = useState('1');
    const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [createCreditNote, setCreateCreditNote] = useState(true);
    const [creditNoteAmount, setCreditNoteAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [cgvAccepted, setCgvAccepted] = useState(false);

    // Dialog dédié création d'avoir (pour factures paid)
    const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);
    const [creditNoteReason, setCreditNoteReason] = useState('');
    const [creditNoteDirectAmount, setCreditNoteDirectAmount] = useState<string>('');
    const [creatingCreditNote, setCreatingCreditNote] = useState(false);

    // Confirmation dialogs intermédiaires
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
    const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
    const [confirmReminderOpen, setConfirmReminderOpen] = useState(false);
    const [confirmChorusOpen, setConfirmChorusOpen] = useState(false);

    // Chorus Pro
    const [chorusSubmission, setChorusSubmission] = useState<ChorusProSubmission | null>(null);
    const [chorusDialogOpen, setChorusDialogOpen] = useState(false);
    const [chorusSubmitting, setChorusSubmitting] = useState(false);
    const [chorusRefreshing, setChorusRefreshing] = useState(false);
    const [chorusEnabled, setChorusEnabled] = useState(false);
    const [chorusSettings, setChorusSettings] = useState<ChorusProSettings | null>(null);
    const [chorusForm, setChorusForm] = useState({
        codeDestinataire: '',
        codeServiceExecutant: '',
        numeroEngagement: '',
        cadreFacturation: 'A1_FACTURE_FOURNISSEUR',
    });

    const loadInvoice = useCallback(async () => {
        if (!currentCompany || !id) return;
        setLoading(true);
        try {
            const [invoiceData, paymentsData, remindersData] = await Promise.all([
                invoiceService.getById(currentCompany.id, id),
                invoiceService.getPayments(currentCompany.id, id),
                reminderService.getAll(currentCompany.id, { invoice_id: id, limit: 50 }),
            ]);
            setInvoice(invoiceData);
            setPayments(paymentsData);
            setReminders(remindersData.reminders || []);
        } catch (error) {
            console.error('Error loading invoice:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de charger la facture',
            });
            navigate('/invoices');
        } finally {
            setLoading(false);
        }
    }, [currentCompany?.id, id]);

    useEffect(() => {
        loadInvoice();
    }, [loadInvoice]);

    // Load Chorus Pro status
    useEffect(() => {
        if (!currentCompany || !id) return;
        // Check if chorus pro is enabled for this company
        chorusProService.getSettings(currentCompany.id).then((settings: ChorusProSettings | null) => {
            setChorusEnabled(!!settings?.enabled);
            setChorusSettings(settings);
        }).catch(() => {});
        // Load submission status
        chorusProService.getSubmissionStatus(id).then((sub) => {
            setChorusSubmission(sub);
        }).catch(() => {});
    }, [currentCompany?.id, id]);

    // WebSocket listeners pour les mises à jour dynamiques
    useWebSocketEvent(['invoice:updated', 'invoice:status_changed'], (updatedInvoice: any) => {
        if (updatedInvoice.id === id) {
            // Mise à jour dynamique de la facture
            setInvoice(prev => prev ? { ...prev, ...updatedInvoice } : updatedInvoice);
        }
    }, [id]);

    useWebSocketEvent(['payment:created'], (payment: any) => {
        // Si le paiement concerne cette facture
        const invoiceId = payment?.invoice_id || payment?.invoice?.id;
        if (invoiceId === id) {
            // Ajouter le paiement à la liste
            setPayments(prev => [payment, ...prev]);
            // Mettre à jour le statut de la facture si fourni
            if (payment.invoice) {
                setInvoice(prev => prev ? { ...prev, ...payment.invoice } : payment.invoice);
            }
        }
    }, [id]);

    // Ouvrir le dialog avoir depuis ?action=credit-note (redirection depuis la liste)
    useEffect(() => {
        if (
            searchParams.get('action') === 'credit-note'
            && invoice?.status === 'paid'
            && permissions.canCreateCreditNote
            && !invoice.has_credit_note
        ) {
            setCreditNoteDirectAmount(Math.abs(invoice.total).toFixed(2));
            setCreditNoteReason('');
            setCreditNoteDialogOpen(true);
            setSearchParams({}, { replace: true });
        }
    }, [invoice?.id, invoice?.status, invoice?.has_credit_note, searchParams]);

    useEffect(() => {
        if (!invoice || !['sent', 'overdue'].includes(invoice.status) || !permissions.canCreateCreditNote) {
            setCreateCreditNote(false);
        }
    }, [invoice?.status, permissions.canCreateCreditNote]);

    const handleOpenCreditNoteDialog = () => {
        if (!invoice || invoice.has_credit_note) return;
        setCreditNoteDirectAmount(Math.abs(invoice.total).toFixed(2));
        setCreditNoteReason('');
        setCreditNoteDialogOpen(true);
    };

    const handleConfirmCreateCreditNote = async () => {
        if (!currentCompany || !invoice || !creditNoteReason.trim()) return;
        setCreatingCreditNote(true);
        try {
            const amount = creditNoteDirectAmount ? parseFloat(creditNoteDirectAmount) : undefined;
            await invoiceService.createCreditNote(currentCompany.id, invoice.id, {
                reason: creditNoteReason,
                amount,
            });
            toast({
                title: 'Avoir créé',
                description: 'L\'avoir a été créé avec succès',
            });
            setCreditNoteDialogOpen(false);
            setCreditNoteReason('');
            const data = await invoiceService.getById(currentCompany.id, invoice.id);
            setInvoice(data);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de créer l\'avoir',
            });
        } finally {
            setCreatingCreditNote(false);
        }
    };

    const handleSend = async () => {
        if (!currentCompany || !invoice) return;
        try {
            const response = await invoiceService.send(currentCompany.id, invoice.id);
            toast({
                title: 'Facture envoyée',
                description: 'La facture a été envoyée au client',
            });
            if (response.warnings?.length) {
                response.warnings.forEach((w: string) => toast({ title: 'Avertissement', description: w }));
            }
            const data = await invoiceService.getById(currentCompany.id, invoice.id);
            setInvoice(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible d\'envoyer la facture',
            });
        }
    };

    const handleDelete = async () => {
        if (!currentCompany || !invoice) return;
        try {
            await invoiceService.delete(currentCompany.id, invoice.id);
            toast({
                title: 'Facture supprimée',
                description: 'La facture a été supprimée avec succès',
            });
            navigate('/invoices');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de supprimer la facture',
            });
        }
    };

    const handleConfirmSend = async () => {
        setSendDialogOpen(false);
        setCgvAccepted(false);
        await handleSend();
    };

    const handleCancel = async () => {
        if (!currentCompany || !invoice) return;
        setCreateCreditNote(false);
        setCreditNoteAmount(Math.abs(invoice.total).toFixed(2));
        setCancelDialogOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!currentCompany || !invoice || !cancelReason.trim()) return;
        setCancelling(true);
        
        try {
            const shouldCreateCreditNote = createCreditNote && ['sent', 'overdue'].includes(invoice.status);
            const creditAmount = creditNoteAmount ? parseFloat(creditNoteAmount) : undefined;
            await invoiceService.cancel(currentCompany.id, invoice.id, {
                reason: cancelReason,
                create_credit_note: shouldCreateCreditNote,
                credit_note_amount: shouldCreateCreditNote ? creditAmount : undefined,
            });
            toast({
                title: 'Facture annulée',
                description: shouldCreateCreditNote
                    ? 'La facture a été annulée et un avoir a été créé'
                    : 'La facture a été annulée',
            });
            setCancelDialogOpen(false);
            setCancelReason('');
            const data = await invoiceService.getById(currentCompany.id, invoice.id);
            setInvoice(data);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'annuler la facture',
            });
        } finally {
            setCancelling(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!currentCompany || !invoice) return;
        try {
            const blob = await invoiceService.downloadPdf(currentCompany.id, invoice.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoice.invoice_number}.pdf`;
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

    const handleResendEmail = async () => {
        if (!currentCompany || !invoice) return;
        setResendingEmail(true);
        try {
            const response = await invoiceService.resendEmail(currentCompany.id, invoice.id);
            toast({
                title: 'Email renvoyé',
                description: 'La facture a été renvoyée par email au client',
            });
            if (response.warning) {
                toast({ title: 'Avertissement', description: response.warning });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de renvoyer l\'email',
            });
        } finally {
            setResendingEmail(false);
        }
    };

    const handleSendReminder = async () => {
        if (!currentCompany || !invoice) return;
        setSendingReminder(true);
        try {
            const response = await invoiceService.sendReminder(currentCompany.id, invoice.id, {
                level: parseInt(reminderLevel),
                include_pdf: true,
            });
            toast({
                title: 'Relance envoyée',
                description: `Une relance de niveau ${reminderLevel} a été envoyée au client`,
            });
            if (response.warning) {
                toast({ title: 'Avertissement', description: response.warning });
            }
            setReminderDialogOpen(false);
            await loadInvoice();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'envoyer la relance',
            });
        } finally {
            setSendingReminder(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!currentCompany || !invoice) return;
        setMarkingPaid(true);
        try {
            const data = await invoiceService.markAsPaid(currentCompany.id, invoice.id, {
                payment_method: paymentMethod,
                reference: paymentReference || undefined,
                notes: paymentNotes || undefined,
            });
            toast({
                title: 'Paiement enregistré',
                description: 'La facture a été marquée comme payée',
            });
            setMarkPaidDialogOpen(false);
            setInvoice(data);
            // Recharger les paiements
            const paymentsData = await invoiceService.getPayments(currentCompany.id, invoice.id);
            setPayments(paymentsData);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de marquer comme payée',
            });
        } finally {
            setMarkingPaid(false);
        }
    };

    const handleSubmitChorus = async () => {
        if (!id) return;
        if (!chorusSettings?.chorus_id_utilisateur_courant) {
            toast({
                variant: 'destructive',
                title: 'Configuration Chorus Pro incomplète',
                description: "Renseigne l'ID utilisateur courant dans les paramètres Chorus Pro de l'entreprise avant d'envoyer la facture.",
            });
            return;
        }
        setChorusSubmitting(true);
        try {
            const sub = await chorusProService.submitInvoice(id, {
                codeDestinataire: chorusForm.codeDestinataire,
                codeServiceExecutant: chorusForm.codeServiceExecutant || undefined,
                numeroEngagement: chorusForm.numeroEngagement || undefined,
                cadreFacturation: chorusForm.cadreFacturation,
            });
            setChorusSubmission(sub);
            setChorusDialogOpen(false);
            toast({
                title: 'Facture envoyée',
                description: 'La facture a été soumise à Chorus Pro',
            });
        } catch (error: any) {
            const message = error.message?.includes("Configuration Chorus Pro incomplète")
                ? error.message
                : error.message || 'Impossible d\'envoyer la facture';
            toast({
                variant: 'destructive',
                title: 'Erreur Chorus Pro',
                description: message,
            });
        } finally {
            setChorusSubmitting(false);
        }
    };

    const handleRefreshChorusStatus = async () => {
        if (!id) return;
        setChorusRefreshing(true);
        try {
            const sub = await chorusProService.getSubmissionStatus(id);
            setChorusSubmission(sub);
            toast({ title: 'Statut mis à jour' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erreur', description: error.message });
        } finally {
            setChorusRefreshing(false);
        }
    };

    const getChorusStatusBadge = (statut: string | null) => {
        if (!statut) return null;
        return getChorusStatusColor(statut);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatDateTime = (date: string) => {
        return new Date(date).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="h-64 lg:col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (!invoice) {
        return null;
    }

    const StatusIcon = statusIcons[invoice.status];
    const paymentProgress = invoice.total > 0 ? (invoice.amount_paid / invoice.total) * 100 : 0;
    const remainingAmount = invoice.total - invoice.amount_paid;
    const sentReminders = reminders
        .filter((reminder) => reminder.status === 'sent')
        .sort((a, b) => new Date(b.sent_at || b.created_at).getTime() - new Date(a.sent_at || a.created_at).getTime());
    const lastReminder = sentReminders[0];
    const reminderTypeLabel = (reminder: Reminder) => {
        if (reminder.level) {
            return `Niveau ${reminder.level}`;
        }
        return reminder.type === 'after_due' ? 'Après échéance' : 'Avant échéance';
    };
    const reminderChannelLabel = (channel: Reminder['channel']) => {
        if (channel === 'email') return 'Email';
        if (channel === 'sms') return 'SMS';
        return 'Email + SMS';
    };

    return (
        <div className="space-y-6">
            {/* En-tête compact */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
                            <Badge className={statusColors[invoice.status]}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusLabels[invoice.status]}
                            </Badge>
                            {invoice.type !== 'invoice' && (
                                <Badge variant="outline">
                                    {invoice.type === 'deposit' ? 'Acompte' : 'Avoir'}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {invoice.client?.company_name || `${invoice.client?.first_name} ${invoice.client?.last_name}`}
                        </p>
                        {invoice.has_credit_note && invoice.linked_credit_note_id && (
                            <div className="mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-orange-200 text-orange-700 hover:text-orange-800"
                                    onClick={() => navigate(`/credit-notes/${invoice.linked_credit_note_id}`)}
                                >
                                    <FileMinus className="mr-2 h-4 w-4" />
                                    Avoir déjà créé
                                    {invoice.linked_credit_note_number ? ` : ${invoice.linked_credit_note_number}` : ''}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Actions groupées */}
                <div className="flex items-center gap-2">
                    {invoice.status === 'draft' && permissions.canEditInvoice && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                        </Button>
                    )}
                    {['draft', 'sent'].includes(invoice.status) && permissions.canSendInvoice && (
                        <Button size="sm" onClick={() => setSendDialogOpen(true)}>
                            <Send className="mr-2 h-4 w-4" />
                            {invoice.status === 'draft' ? 'Envoyer' : 'Renvoyer'}
                        </Button>
                    )}
                    {['sent', 'overdue'].includes(invoice.status) && permissions.canEditInvoice && (
                        <>
                            <Button size="sm" onClick={() => navigate(`/invoices/${invoice.id}/payment`)}>
                                <Banknote className="mr-2 h-4 w-4" />
                                Paiement
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setMarkPaidDialogOpen(true)}>
                                <Coins className="mr-2 h-4 w-4" />
                                Espèces
                            </Button>
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                    
                    {/* Menu actions supplémentaires */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {['sent', 'overdue'].includes(invoice.status) && permissions.canSendInvoice && (
                                <>
                                    <DropdownMenuItem
                                        onClick={handleResendEmail}
                                        disabled={resendingEmail}
                                    >
                                        <RefreshCw className={`mr-2 h-4 w-4 ${resendingEmail ? 'animate-spin' : ''}`} />
                                        Renvoyer par email
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {chorusEnabled
                                && invoice.client?.client_sector === 'public'
                                && invoice.client?.chorus_pro_eligibility_status === 'eligible'
                                && !['cancelled', 'draft'].includes(invoice.status)
                                && (!chorusSubmission || ['REJETEE', 'SUSPENDUE'].includes(chorusSubmission.statut_chorus || ''))
                                && permissions.canSendInvoice
                            && (
                                <>
                                    <DropdownMenuItem onClick={() => {
                                        const client = invoice.client;
                                        setChorusForm({
                                            codeDestinataire: client?.chorus_pro_code_destinataire || '',
                                            codeServiceExecutant: client?.chorus_pro_code_service_executant || chorusSettings?.default_code_service_executant || '',
                                            numeroEngagement: client?.chorus_pro_numero_engagement || '',
                                            cadreFacturation: client?.chorus_pro_cadre_facturation || chorusSettings?.default_cadre_facturation || 'A1_FACTURE_FOURNISSEUR',
                                        });
                                        setChorusDialogOpen(true);
                                    }}>
                                        <Send className="mr-2 h-4 w-4" />
                                        Envoyer sur Chorus Pro
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {['sent', 'overdue'].includes(invoice.status) && permissions.canDeleteInvoice && (
                                <DropdownMenuItem
                                    onClick={handleCancel}
                                    className="text-red-600"
                                >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Annuler la facture
                                </DropdownMenuItem>
                            )}
                            {invoice.status === 'paid' && permissions.canCreateCreditNote && !invoice.has_credit_note && (
                                <DropdownMenuItem
                                    onClick={handleOpenCreditNoteDialog}
                                    className="text-orange-600"
                                >
                                    <FileMinus className="mr-2 h-4 w-4" />
                                    Créer un avoir
                                </DropdownMenuItem>
                            )}
                            {invoice.status === 'draft' && permissions.canDeleteInvoice && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Supprimer
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>


            <div className="grid gap-6 lg:grid-cols-3">
                {/* Informations client et facture */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Client */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building className="h-5 w-5" />
                                Client
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {invoice.client && (
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {invoice.client.company_name || 
                                         `${invoice.client.first_name} ${invoice.client.last_name}`}
                                    </p>
                                    {invoice.client.email && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Mail className="h-4 w-4" />
                                            {invoice.client.email}
                                        </p>
                                    )}
                                    {invoice.client.phone && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Phone className="h-4 w-4" />
                                            {invoice.client.phone}
                                        </p>
                                    )}
                                    {invoice.client.address && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            {invoice.client.address}
                                            {invoice.client.postal_code && `, ${invoice.client.postal_code}`}
                                            {invoice.client.city && ` ${invoice.client.city}`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Articles */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Articles</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Qté</TableHead>
                                        <TableHead className="text-right">Prix unit. HT</TableHead>
                                        <TableHead className="text-right">TVA</TableHead>
                                        <TableHead className="text-right">Total HT</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const rows = groupItemsForReadOnly(invoice.items || [], (item) => item.product_id);
                                        return rows.map((row) => {
                                            if (row.type === 'single') {
                                                const item = row.item;
                                                return (
                                                    <TableRow key={item.id || row.index}>
                                                        <TableCell>{item.description}</TableCell>
                                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                                        <TableCell className="text-right">{item.vat_rate}%</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {formatCurrency(item.line_total)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }
                                            return (
                                                <React.Fragment key={`group-${row.productId}-${row.startIndex}`}>
                                                    <TableRow className="bg-muted/50">
                                                        <TableCell colSpan={5} className="font-medium">
                                                            {row.productName}
                                                        </TableCell>
                                                    </TableRow>
                                                    {row.items.map((gi) => {
                                                        const item = gi.item;
                                                        return (
                                                            <TableRow key={item.id || gi.index} className="bg-muted/30">
                                                                <TableCell className="pl-6">{item.description}</TableCell>
                                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                                                <TableCell className="text-right">{item.vat_rate}%</TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatCurrency(item.line_total)}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Historique des paiements */}
                    {payments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Banknote className="h-5 w-5" />
                                    Historique des paiements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Méthode</TableHead>
                                            <TableHead>Référence</TableHead>
                                            <TableHead className="text-right">Montant</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>{payment.paid_at ? formatDate(payment.paid_at) : '-'}</TableCell>
                                                <TableCell className="capitalize">
                                                    {payment.payment_method === 'card' ? 'Carte bancaire' :
                                                     payment.payment_method === 'bank_transfer' ? 'Virement' :
                                                     payment.payment_method === 'cash' ? 'Espèces' :
                                                     payment.payment_method === 'check' ? 'Chèque' :
                                                     payment.payment_method}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {payment.reference || '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-green-600">
                                                    {formatCurrency(payment.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notes et conditions */}
                    {(invoice.notes || invoice.terms_and_conditions) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notes et conditions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {invoice.notes && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Notes</p>
                                        <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                            {invoice.notes}
                                        </p>
                                    </div>
                                )}
                                {invoice.notes && invoice.terms_and_conditions && <Separator />}
                                {invoice.terms_and_conditions && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Conditions générales</p>
                                        <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                            {invoice.terms_and_conditions}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Colonne droite: Totaux et paiement */}
                <div className="space-y-6">
                    {/* Dates et Relance */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Dates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Date d'émission</span>
                                <span>{formatDate(invoice.issue_date)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Date d'échéance</span>
                                <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                    {formatDate(invoice.due_date)}
                                </span>
                            </div>
                            {invoice.sent_at && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Envoyée le</span>
                                    <span>{formatDate(invoice.sent_at)}</span>
                                </div>
                            )}
                            {invoice.paid_at && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Payée le</span>
                                    <span>{formatDate(invoice.paid_at)}</span>
                                </div>
                            )}
                            
                            {/* Bouton de relance dans le bloc Dates */}
                            {['sent', 'overdue'].includes(invoice.status) && permissions.canSendInvoice && (
                                <>
                                    <Separator className="my-3" />
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setReminderDialogOpen(true)}
                                        className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                    >
                                        <Bell className="mr-2 h-4 w-4" />
                                        Envoyer une relance
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Relances envoyées
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-semibold">{sentReminders.length}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Dernière relance</span>
                                    <span>{lastReminder ? formatDateTime(lastReminder.sent_at || lastReminder.created_at) : 'Aucune'}</span>
                                </div>
                            </div>

                            {sentReminders.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aucune relance envoyée pour cette facture.</p>
                            ) : (
                                <div className="space-y-3">
                                    {sentReminders.map((reminder) => (
                                        <div key={reminder.id} className="rounded-lg border p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium">{reminderTypeLabel(reminder)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDateTime(reminder.sent_at || reminder.created_at)}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline">
                                                        {reminderChannelLabel(reminder.channel)}
                                                    </Badge>
                                                    <Badge className="bg-green-100 text-green-800">
                                                        Envoyée
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Totaux */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Récapitulatif</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sous-total HT</span>
                                <span>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount_amount && invoice.discount_amount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>Remise {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}</span>
                                    <span>-{formatCurrency(invoice.discount_amount)}</span>
                                </div>
                            )}
                            {!invoice.company?.is_vat_exempt && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">TVA</span>
                                <span>{formatCurrency(invoice.total_vat)}</span>
                            </div>
                            )}
                            <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <span>{invoice.company?.is_vat_exempt ? 'Total HT' : 'Total TTC'}</span>
                                <span>{formatCurrency(invoice.total)}</span>
                            </div>
                            {invoice.company?.is_vat_exempt && (
                                <p className="text-xs text-muted-foreground">
                                    {invoice.company.vat_exemption_note || 'TVA non applicable, art. 293 B du CGI'}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Progression du paiement */}
                    {invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Euro className="h-5 w-5" />
                                    Paiement
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progression</span>
                                        <span>{Math.round(paymentProgress)}%</span>
                                    </div>
                                    <Progress value={paymentProgress} className="h-2" />
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Payé</span>
                                    <span className="text-green-600 font-medium">
                                        {formatCurrency(invoice.amount_paid)}
                                    </span>
                                </div>
                                {remainingAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Reste à payer</span>
                                        <span className="text-orange-600 font-medium">
                                            {formatCurrency(remainingAmount)}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Chorus Pro Status */}
                    {chorusSubmission && (
                        <Card className="border-blue-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <Send className="h-4 w-4" />
                                    Chorus Pro
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Statut</span>
                                    <Badge className={getChorusStatusBadge(chorusSubmission.statut_chorus) || ''}>
                                        {chorusSubmission.statut_chorus ? getChorusStatusLabel(chorusSubmission.statut_chorus) : 'Inconnu'}
                                    </Badge>
                                </div>
                                {chorusSubmission.identifiant_facture_cpp && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">ID CPP</span>
                                        <span className="font-mono">{chorusSubmission.identifiant_facture_cpp}</span>
                                    </div>
                                )}
                                {chorusSubmission.numero_facture_chorus && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">N° Chorus</span>
                                        <span className="font-mono">{chorusSubmission.numero_facture_chorus}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Envoyée le</span>
                                    <span>{new Date(chorusSubmission.submitted_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                                {chorusSubmission.error_message && (
                                    <div className="rounded bg-red-50 p-2 text-xs text-red-700">
                                        {chorusSubmission.error_message}
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleRefreshChorusStatus}
                                    disabled={chorusRefreshing}
                                >
                                    <RefreshCw className={`mr-2 h-3 w-3 ${chorusRefreshing ? 'animate-spin' : ''}`} />
                                    Actualiser le statut
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Annulation */}
                    {invoice.status === 'cancelled' && invoice.cancelled_reason && (
                        <Card className="border-red-200 bg-red-50">
                            <CardHeader>
                                <CardTitle className="text-red-800 flex items-center gap-2">
                                    <Ban className="h-5 w-5" />
                                    Annulée
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-red-700">{invoice.cancelled_reason}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Devis lié */}
                    {invoice.quote_id && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Devis lié
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => navigate(`/quotes/${invoice.quote_id}`)}
                                >
                                    Voir le devis d'origine
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Dialog de relance */}
            <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Envoyer une relance</DialogTitle>
                        <DialogDescription>
                            Envoyez un email de relance au client pour le paiement de cette facture.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Niveau de relance</Label>
                            <Select value={reminderLevel} onValueChange={setReminderLevel}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">
                                        Niveau 1 - Rappel amical
                                    </SelectItem>
                                    <SelectItem value="2">
                                        Niveau 2 - Rappel ferme
                                    </SelectItem>
                                    <SelectItem value="3">
                                        Niveau 3 - Mise en demeure
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {reminderLevel === '1' && (
                                <p>Un rappel courtois sera envoyé, rappelant simplement l'échéance de paiement.</p>
                            )}
                            {reminderLevel === '2' && (
                                <p>Un rappel plus insistant sera envoyé, avec mention des pénalités de retard.</p>
                            )}
                            {reminderLevel === '3' && (
                                <p>Une mise en demeure formelle sera envoyée, avec mention des actions légales possibles.</p>
                            )}
                        </div>
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => setConfirmReminderOpen(true)}
                            disabled={sendingReminder}
                            className="bg-orange-500 hover:bg-orange-600"
                        >
                            <Bell className="mr-2 h-4 w-4" />
                            Envoyer la relance
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation finale relance */}
            <ConfirmationDialog
                open={confirmReminderOpen}
                onConfirm={() => {
                    setConfirmReminderOpen(false);
                    handleSendReminder();
                }}
                onCancel={() => setConfirmReminderOpen(false)}
                title="Envoyer cette relance ?"
                description={`Une relance de niveau ${reminderLevel} sera envoyée par email au client.`}
                confirmLabel="Envoyer la relance"
            />

            {/* Dialog de paiement espèces */}
            <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Enregistrer un paiement</DialogTitle>
                        <DialogDescription>
                            Marquer cette facture comme entièrement payée (paiement en espèces ou autre).
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Mode de paiement</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Espèces</SelectItem>
                                    <SelectItem value="check">Chèque</SelectItem>
                                    <SelectItem value="transfer">Virement</SelectItem>
                                    <SelectItem value="other">Autre</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Référence (optionnel)</Label>
                            <Input
                                placeholder="Ex: Chèque n°123456"
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (optionnel)</Label>
                            <Input
                                placeholder="Notes sur le paiement"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                            />
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-sm text-green-800">
                                <strong>Montant à enregistrer :</strong> {formatCurrency(invoice.total - invoice.amount_paid)}
                            </p>
                        </div>
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => setConfirmPaymentOpen(true)}
                            disabled={markingPaid}
                            className="bg-green-500 hover:bg-green-600"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Marquer comme payée
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation finale paiement */}
            <ConfirmationDialog
                open={confirmPaymentOpen}
                onConfirm={() => {
                    setConfirmPaymentOpen(false);
                    handleMarkAsPaid();
                }}
                onCancel={() => setConfirmPaymentOpen(false)}
                title="Confirmer l'enregistrement du paiement ?"
                description={`Un paiement de ${invoice ? formatCurrency(invoice.total - invoice.amount_paid) : ''} sera enregistré. Le statut de la facture sera mis à jour.`}
                confirmLabel="Enregistrer le paiement"
            />

            {/* Dialog d'annulation avec création d'avoir */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Annuler la facture</DialogTitle>
                        <DialogDescription>
                            Annuler cette facture et éventuellement créer un avoir pour le client.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Raison de l'annulation *</Label>
                            <Textarea
                                placeholder="Ex: Erreur de facturation, demande du client..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        {['sent', 'overdue'].includes(invoice.status) && permissions.canCreateCreditNote ? (
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Créer un avoir</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Générer un avoir pour le montant total de la facture
                                    </p>
                                </div>
                                <Switch
                                    checked={createCreditNote}
                                    onCheckedChange={setCreateCreditNote}
                                />
                            </div>
                        ) : !permissions.canCreateCreditNote ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    Seul un administrateur peut créer un avoir.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    Un avoir ne peut être créé que sur une facture envoyée ou en retard.
                                </p>
                            </div>
                        )}
                        {createCreditNote && ['sent', 'overdue'].includes(invoice.status) && (
                            <>
                                <div className="space-y-2">
                                    <Label>Montant de l'avoir</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max={Math.abs(invoice.total)}
                                            value={creditNoteAmount}
                                            onChange={(e) => setCreditNoteAmount(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Maximum : {formatCurrency(invoice.total)} (montant total)
                                    </p>
                                </div>
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <p className="text-sm text-orange-800 font-medium">
                                        Attention : l'avoir créé ne pourra plus être modifié ni supprimé.
                                    </p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-800">
                                        Un avoir de <strong>{creditNoteAmount ? formatCurrency(parseFloat(creditNoteAmount)) : formatCurrency(invoice.total)}</strong>
                                        {creditNoteAmount && parseFloat(creditNoteAmount) < Math.abs(invoice.total) ? ' (partiel)' : ''} sera créé et envoyé au client.
                                    </p>
                                </div>
                            </>
                        )}
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => setConfirmCancelOpen(true)}
                            disabled={cancelling || !cancelReason.trim()}
                            variant="destructive"
                        >
                            <Ban className="mr-2 h-4 w-4" />
                            Confirmer l'annulation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation finale annulation */}
            <ConfirmationDialog
                open={confirmCancelOpen}
                onConfirm={() => {
                    setConfirmCancelOpen(false);
                    handleConfirmCancel();
                }}
                onCancel={() => setConfirmCancelOpen(false)}
                title="Annuler définitivement cette facture ?"
                description={createCreditNote && ['sent', 'overdue'].includes(invoice.status)
                    ? `La facture sera annulée et un avoir de ${creditNoteAmount ? formatCurrency(parseFloat(creditNoteAmount)) : formatCurrency(invoice.total)}${creditNoteAmount && parseFloat(creditNoteAmount) < Math.abs(invoice.total) ? ' (partiel)' : ''} sera créé et envoyé au client. Cette action est irréversible.`
                    : "La facture sera annulée. Cette action est irréversible."}
                confirmLabel="Annuler la facture"
                variant="destructive"
            />

            {/* Dialog création d'avoir (facture payée) */}
            <Dialog open={creditNoteDialogOpen} onOpenChange={(open) => { if (!open) setCreditNoteDialogOpen(false); }}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Créer un avoir</DialogTitle>
                        <DialogDescription>
                            Créer un avoir pour cette facture payée. L'avoir sera envoyé au client.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Raison de l'avoir *</Label>
                            <Textarea
                                placeholder="Ex: Remboursement, erreur de facturation..."
                                value={creditNoteReason}
                                onChange={(e) => setCreditNoteReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Montant de l'avoir</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={invoice ? Math.abs(invoice.total) : undefined}
                                    value={creditNoteDirectAmount}
                                    onChange={(e) => setCreditNoteDirectAmount(e.target.value)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Maximum : {invoice ? formatCurrency(invoice.total) : '—'} (montant total)
                            </p>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <p className="text-sm text-orange-800 font-medium">
                                Attention : l'avoir créé ne pourra plus être modifié ni supprimé.
                            </p>
                        </div>
                        {creditNoteDirectAmount && invoice && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800">
                                    Un avoir de <strong>{formatCurrency(parseFloat(creditNoteDirectAmount))}</strong>
                                    {parseFloat(creditNoteDirectAmount) < Math.abs(invoice.total) ? ' (partiel)' : ''} sera créé et envoyé au client.
                                </p>
                            </div>
                        )}
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setCreditNoteDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleConfirmCreateCreditNote}
                            disabled={creatingCreditNote || !creditNoteReason.trim()}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            <FileMinus className="mr-2 h-4 w-4" />
                            {creatingCreditNote ? 'Création...' : 'Créer l\'avoir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog confirmation envoi */}
            <Dialog open={sendDialogOpen} onOpenChange={(open) => { if (!open) { setSendDialogOpen(false); setCgvAccepted(false); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {invoice?.status === 'sent'
                                ? 'Confirmer le nouvel envoi de la facture'
                                : 'Confirmer l\'envoi de la facture'}
                        </DialogTitle>
                        <DialogDescription>
                            {invoice?.status === 'sent'
                                ? 'La facture sera renvoyée au client par email.'
                                : 'Une fois envoyée, la facture ne pourra plus être modifiée ni supprimée.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {invoice?.terms_and_conditions && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={cgvAccepted}
                                    onChange={(e) => setCgvAccepted(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">
                                    J'ai vérifié les conditions générales de vente jointes à cette facture
                                </span>
                            </label>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSendDialogOpen(false); setCgvAccepted(false); }}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleConfirmSend}
                            disabled={!!invoice?.terms_and_conditions && !cgvAccepted}
                        >
                            <Send className="mr-2 h-4 w-4" />
                            {invoice?.status === 'sent' ? 'Confirmer le renvoi' : 'Confirmer l\'envoi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog confirmation suppression */}
            <ConfirmationDialog
                open={deleteDialogOpen}
                onConfirm={handleDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                title="Supprimer cette facture ?"
                description="Cette action est irréversible."
                confirmLabel="Supprimer"
                variant="destructive"
            />

            {/* Dialog Chorus Pro */}
            <Dialog open={chorusDialogOpen} onOpenChange={setChorusDialogOpen}>
                <DialogContent className="gap-0 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Envoyer sur Chorus Pro</DialogTitle>
                        <DialogDescription>
                            Soumettre cette facture via Chorus Pro au destinataire public.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="px-6 py-4">
                        <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Code destinataire (SIRET) *</Label>
                            <Input
                                value={chorusForm.codeDestinataire}
                                readOnly
                                className="bg-muted"
                                placeholder="Renseigné automatiquement par la vérification"
                            />
                            {invoice.client?.chorus_pro_structure_label && (
                                <p className="text-xs text-muted-foreground">
                                    Structure : {invoice.client.chorus_pro_structure_label}
                                </p>
                            )}
                        </div>
                        {invoice.client?.chorus_pro_service_code_required && (
                            <div className="space-y-2">
                                <Label>Code service exécutant *</Label>
                                <Input
                                    value={chorusForm.codeServiceExecutant}
                                    onChange={(e) => setChorusForm(prev => ({ ...prev, codeServiceExecutant: e.target.value }))}
                                    placeholder="Code service"
                                />
                            </div>
                        )}
                        {invoice.client?.chorus_pro_engagement_required && (
                            <div className="space-y-2">
                                <Label>Numéro d'engagement *</Label>
                                <Input
                                    value={chorusForm.numeroEngagement}
                                    onChange={(e) => setChorusForm(prev => ({ ...prev, numeroEngagement: e.target.value }))}
                                    placeholder="Numéro d'engagement"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Cadre de facturation</Label>
                            <Select
                                value={chorusForm.cadreFacturation}
                                onValueChange={(value) => setChorusForm(prev => ({ ...prev, cadreFacturation: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A1_FACTURE_FOURNISSEUR">A1 - Facture fournisseur</SelectItem>
                                    <SelectItem value="A2_FACTURE_FOURNISSEUR_DEJA_PAYEE">A2 - Facture déjà payée</SelectItem>
                                    <SelectItem value="A9_FACTURE_SOUSTRAITANT">A9 - Facture sous-traitant</SelectItem>
                                    <SelectItem value="A12_FACTURE_COTRAITANT">A12 - Facture co-traitant</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                    </DialogBody>
                    <DialogFooter className="border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setChorusDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => setConfirmChorusOpen(true)}
                            disabled={
                                chorusSubmitting
                                || !chorusForm.codeDestinataire
                                || (!!invoice.client?.chorus_pro_service_code_required && !chorusForm.codeServiceExecutant)
                                || (!!invoice.client?.chorus_pro_engagement_required && !chorusForm.numeroEngagement)
                            }
                        >
                            <Send className="mr-2 h-4 w-4" />
                            Envoyer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation finale Chorus Pro */}
            <ConfirmationDialog
                open={confirmChorusOpen}
                onConfirm={() => {
                    setConfirmChorusOpen(false);
                    handleSubmitChorus();
                }}
                onCancel={() => setConfirmChorusOpen(false)}
                title="Soumettre cette facture sur Chorus Pro ?"
                description={`La facture sera envoyée au destinataire ${chorusForm.codeDestinataire} via Chorus Pro. Cette action ne peut pas être annulée.`}
                confirmLabel="Soumettre sur Chorus Pro"
            />
        </div>
    );
}
