import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Edit, Send, Copy, Download, FileText,
    CheckCircle, XCircle, Clock, AlertTriangle, Building,
    Mail, Phone, MapPin, Eye
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
import { legalService, quoteService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import type { Quote, QuoteStatus, QuoteSignatureDocument } from '@/types';
import { groupItemsForReadOnly } from '@/lib/multi-tax-utils';

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

const statusIcons: Record<QuoteStatus, any> = {
    draft: FileText,
    sent: Send,
    viewed: Eye,
    accepted: CheckCircle,
    signed: CheckCircle,
    refused: XCircle,
    expired: AlertTriangle,
    converted: FileText,
};

export function QuoteDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);

    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [convertDialogOpen, setConvertDialogOpen] = useState(false);
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [cgvAccepted, setCgvAccepted] = useState(false);
    const [publishedSalesTermsVersion, setPublishedSalesTermsVersion] = useState<number | null>(null);
    const [signatureDocuments, setSignatureDocuments] = useState<QuoteSignatureDocument[]>([]);
    const [signatureDocumentsLoading, setSignatureDocumentsLoading] = useState(false);

    const loadQuote = useCallback(async () => {
        if (!currentCompany || !id) return;
        setLoading(true);
        try {
            const [data, legalDocuments] = await Promise.all([
                quoteService.getById(currentCompany.id, id),
                legalService.getCompanyDocuments(currentCompany.id).catch(() => null),
            ]);

            const salesTermsDocument = legalDocuments?.documents.find(
                (document) => document.document_type === 'sales_terms',
            );

            setQuote(data);
            setPublishedSalesTermsVersion(salesTermsDocument?.published_version?.version_number ?? null);
        } catch (error: any) {
            console.error('Error loading quote:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger le devis',
            });
            navigate('/quotes');
        } finally {
            setLoading(false);
        }
    }, [currentCompany?.id, id]);

    useEffect(() => {
        loadQuote();
    }, [loadQuote]);

    useEffect(() => {
        const loadSignatureDocuments = async () => {
            if (
                !currentCompany ||
                !quote ||
                !['signed', 'converted'].includes(quote.status)
            ) {
                setSignatureDocuments([]);
                return;
            }

            setSignatureDocumentsLoading(true);
            try {
                const documents = await quoteService.getSignatureDocuments(currentCompany.id, quote.id);
                setSignatureDocuments(documents);
            } catch (error: any) {
                console.error('Error loading signature documents:', error);
                setSignatureDocuments([]);
            } finally {
                setSignatureDocumentsLoading(false);
            }
        };

        loadSignatureDocuments();
    }, [currentCompany?.id, quote?.id, quote?.status]);

    // WebSocket listeners pour les mises à jour dynamiques
    useWebSocketEvent(['quote:updated', 'quote:status_changed', 'quote:signed'], (updatedQuote: any) => {
        if (updatedQuote.id === id) {
            // Mise à jour dynamique du devis
            setQuote(prev => prev ? { ...prev, ...updatedQuote } : updatedQuote);
        }
    }, [id]);

    const handleSend = async () => {
        if (!currentCompany || !quote) return;
        const hasQuoteTerms = Boolean(quote.terms_and_conditions?.trim());
        const requiresNoTermsConfirmation = !hasQuoteTerms && !hasPublishedCompanyTerms;
        try {
            const response = await quoteService.send(currentCompany.id, quote.id, {
                confirm_send_without_cgv: requiresNoTermsConfirmation || undefined,
            });
            toast({
                title: 'Devis envoyé',
                description: 'Le devis a été envoyé au client',
            });
            if (response.warnings?.length) {
                response.warnings.forEach((w: string) => toast({ title: 'Avertissement', description: w }));
            }
            // Refresh quote
            const data = await quoteService.getById(currentCompany.id, quote.id);
            setQuote(data);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible d\'envoyer le devis',
            });
        }
    };

    const handleDuplicate = async () => {
        if (!currentCompany || !quote) return;
        try {
            const newQuote = await quoteService.duplicate(currentCompany.id, quote.id);
            toast({
                title: 'Devis dupliqué',
                description: 'Le nouveau devis a été créé',
            });
            navigate(`/quotes/${newQuote.id}/edit`);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de dupliquer le devis',
            });
        }
    };

    const handleConvert = async () => {
        if (!currentCompany || !quote) return;
        try {
            const invoice = await quoteService.convert(currentCompany.id, quote.id);
            toast({
                title: 'Facture créée',
                description: 'Le devis a été converti en facture',
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

    const handleDownloadPdf = async () => {
        if (!currentCompany || !quote) return;
        try {
            const blob = await quoteService.downloadPdf(currentCompany.id, quote.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quote.quote_number}.pdf`;
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

    const handleDownloadSignatureDocument = async (signatureDocument: QuoteSignatureDocument) => {
        if (!currentCompany || !quote) return;
        try {
            const blob = await quoteService.downloadSignatureDocument(currentCompany.id, quote.id, signatureDocument.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = signatureDocument.filename;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de télécharger le document de signature',
            });
        }
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

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="h-64 lg:col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (!quote) {
        return null;
    }

    const StatusIcon = statusIcons[quote.status];
    const hasQuoteTerms = Boolean(quote.terms_and_conditions?.trim());
    const hasPublishedCompanyTerms = publishedSalesTermsVersion !== null;
    const requiresTermsConfirmation = hasQuoteTerms;
    const requiresNoTermsConfirmation = !hasQuoteTerms && !hasPublishedCompanyTerms;
    const cgvStatusTitle = hasQuoteTerms
        ? 'CGV déjà attachées au devis'
        : hasPublishedCompanyTerms
            ? `CGV entreprise publiées prêtes à être figées (version ${publishedSalesTermsVersion})`
            : 'Aucune CGV disponible pour ce devis';
    const cgvStatusDescription = hasQuoteTerms
        ? 'Le texte présent sur ce devis sera figé au moment de l’envoi et restera celui présenté au client lors de la signature.'
        : hasPublishedCompanyTerms
            ? 'Aucune CGV n’est saisie directement sur ce devis. La version publiée de votre entreprise sera attachée automatiquement à l’envoi.'
            : 'Ce devis sera envoyé sans CGV. Vérifiez ce point avant de confirmer l’envoi.';
    const hasLegacySignatureArtifacts =
        quote.signature_provider === 'yousign' && ['signed', 'converted'].includes(quote.status);
    const signedQuoteDocument = signatureDocuments.find((document) => document.kind === 'signed_quote');
    const auditTrailDocument = signatureDocuments.find((document) => document.kind === 'audit_trail');

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* En-tête */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{quote.quote_number}</h1>
                            <Badge className={statusColors[quote.status]}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusLabels[quote.status]}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground">
                            Créé le {formatDate(quote.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {quote.status === 'draft' && permissions.canEditQuote && (
                        <>
                            <Button variant="outline" onClick={() => navigate(`/quotes/${quote.id}/edit`)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                            </Button>
                        </>
                    )}
                    {quote.status === 'draft' && permissions.canSendQuote && (
                        <Button onClick={() => setSendDialogOpen(true)}>
                            <Send className="mr-2 h-4 w-4" />
                            Envoyer
                        </Button>
                    )}
                    {['accepted', 'signed'].includes(quote.status) && permissions.canCreateInvoice && (
                        <Button onClick={() => setConvertDialogOpen(true)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Convertir en facture
                        </Button>
                    )}
                    {permissions.canCreateQuote && (
                        <Button variant="outline" onClick={handleDuplicate}>
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleDownloadPdf}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Informations client et devis */}
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
                            {quote.client && (
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {quote.client.company_name || 
                                         `${quote.client.first_name} ${quote.client.last_name}`}
                                    </p>
                                    {quote.client.email && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Mail className="h-4 w-4" />
                                            {quote.client.email}
                                        </p>
                                    )}
                                    {quote.client.phone && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Phone className="h-4 w-4" />
                                            {quote.client.phone}
                                        </p>
                                    )}
                                    {quote.client.address && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            {quote.client.address}
                                            {quote.client.postal_code && `, ${quote.client.postal_code}`}
                                            {quote.client.city && ` ${quote.client.city}`}
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
                                        const rows = groupItemsForReadOnly(quote.items || [], (item) => item.product_id);
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

                    {/* Notes et conditions */}
                    {(quote.notes || quote.terms_and_conditions || quote.status === 'draft') && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notes et conditions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {quote.notes && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Notes</p>
                                        <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                            {quote.notes}
                                        </p>
                                    </div>
                                )}
                                {quote.notes && quote.terms_and_conditions && <Separator />}
                                {quote.terms_and_conditions && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Conditions générales</p>
                                        <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                            {quote.terms_and_conditions}
                                        </p>
                                    </div>
                                )}
                                {quote.status === 'draft' && (
                                    <>
                                        {(quote.notes || quote.terms_and_conditions) && <Separator />}
                                        <div
                                            className={`rounded-lg px-4 py-3 text-sm ${
                                                !requiresNoTermsConfirmation
                                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                                                    : 'border border-amber-200 bg-amber-50 text-amber-900'
                                            }`}
                                        >
                                            <p className="font-medium">{cgvStatusTitle}</p>
                                            <p className="mt-1">{cgvStatusDescription}</p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Colonne droite: Totaux et informations */}
                <div className="space-y-6">
                    {/* Dates */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Dates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Date d'émission</span>
                                <span>{formatDate(quote.issue_date)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Valide jusqu'au</span>
                                <span>{formatDate(quote.validity_date)}</span>
                            </div>
                            {quote.signed_at && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Signé le</span>
                                    <span>{formatDate(quote.signed_at)}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {hasLegacySignatureArtifacts && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Documents de signature</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {signatureDocumentsLoading ? (
                                    <p className="text-sm text-muted-foreground">
                                        Chargement des documents de signature...
                                    </p>
                                ) : signatureDocuments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Aucun document de signature archivé pour ce devis.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {signedQuoteDocument && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => handleDownloadSignatureDocument(signedQuoteDocument)}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Télécharger le PDF signé
                                            </Button>
                                        )}
                                        {auditTrailDocument && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => handleDownloadSignatureDocument(auditTrailDocument)}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Télécharger la preuve de signature
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Totaux */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Récapitulatif</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sous-total HT</span>
                                <span>{formatCurrency(quote.subtotal)}</span>
                            </div>
                            {quote.discount_amount && quote.discount_amount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>Remise {quote.discount_type === 'percentage' ? `(${quote.discount_value}%)` : ''}</span>
                                    <span>-{formatCurrency(quote.discount_amount)}</span>
                                </div>
                            )}
                            {!quote.company?.is_vat_exempt && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">TVA</span>
                                <span>{formatCurrency(quote.total_vat)}</span>
                            </div>
                            )}
                            <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <span>{quote.company?.is_vat_exempt ? 'Total HT' : 'Total TTC'}</span>
                                <span>{formatCurrency(quote.total)}</span>
                            </div>
                            {quote.company?.is_vat_exempt && (
                                <p className="text-xs text-muted-foreground">
                                    {quote.company.vat_exemption_note || 'TVA non applicable, art. 293 B du CGI'}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Signature si refusé */}
                    {quote.status === 'refused' && quote.refusal_reason && (
                        <Card className="border-red-200 bg-red-50">
                            <CardHeader>
                                <CardTitle className="text-red-800 flex items-center gap-2">
                                    <XCircle className="h-5 w-5" />
                                    Refusé
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-red-700">{quote.refusal_reason}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Signature si accepté */}
                    {['accepted', 'signed'].includes(quote.status) && quote.signed_at && (
                        <Card className="border-green-200 bg-green-50">
                            <CardHeader>
                                <CardTitle className="text-green-800 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Signé
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {quote.signed_by && (
                                    <p className="text-sm text-green-700">
                                        Signé par: {quote.signed_by}
                                    </p>
                                )}
                                <p className="text-sm text-green-700">
                                    Le {formatDate(quote.signed_at)}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Dialog envoi avec CGV */}
            <AlertDialog open={sendDialogOpen} onOpenChange={(open) => { if (!open) { setSendDialogOpen(false); setCgvAccepted(false); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Envoyer ce devis ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Le devis sera envoyé par email avec un lien public de consultation et de signature.
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
                                    J'ai vérifié les conditions générales de vente jointes à ce devis
                                </span>
                            </label>
                        </div>
                    )}
                    {!requiresTermsConfirmation && hasPublishedCompanyTerms && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            Les CGV publiées de l’entreprise seront automatiquement attachées à ce devis lors de l’envoi
                            et visibles au client sur la page de signature.
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
                        <AlertDialogCancel onClick={() => setCgvAccepted(false)}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { setCgvAccepted(false); handleSend(); }}
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
                        <AlertDialogAction onClick={handleConvert}>Convertir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
