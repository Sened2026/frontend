import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle, XCircle, Building, Mail, MapPin, Phone,
    AlertTriangle, Loader2, PenLine, Clock, Download, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { groupItemsForReadOnly } from '@/lib/multi-tax-utils';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { getApiBaseUrl } from '@/lib/api-config';
import type { PublicQuote } from '@/types';

const API_URL = getApiBaseUrl();

interface RefuseQuoteResponse {
    quote: PublicQuote;
    message: string;
}

interface SignQuoteResponse {
    quote: PublicQuote;
    invoice_id: string;
    message: string;
}

export function QuoteSignPage() {
    const { token } = useParams<{ token: string }>();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quote, setQuote] = useState<PublicQuote | null>(null);
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [refused, setRefused] = useState(false);

    // Signature state
    const [showSignatureForm, setShowSignatureForm] = useState(false);
    const [signedBy, setSignedBy] = useState('');
    const [signerEmail, setSignerEmail] = useState('');
    const [cgvAccepted, setCgvAccepted] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [cgvExpanded, setCgvExpanded] = useState(false);

    // Refusal state
    const [showRefusalForm, setShowRefusalForm] = useState(false);
    const [refusalReason, setRefusalReason] = useState('');

    // Confirmation dialogs
    const [showSignConfirm, setShowSignConfirm] = useState(false);
    const [showRefuseConfirm, setShowRefuseConfirm] = useState(false);
    const syncQuoteState = useCallback((data: PublicQuote) => {
        setQuote(data);
        setError(null);
        setSigned(['accepted', 'signed', 'converted'].includes(data.status));
        setRefused(data.status === 'refused');
        setShowSignatureForm(false);
        setShowRefusalForm(false);
        setShowSignConfirm(false);
        setShowRefuseConfirm(false);
        setSignerEmail((prev) => prev || data.client?.email || '');
        setCgvExpanded(false);
    }, []);

    const loadQuote = useCallback(async (showLoader = true) => {
        if (!token) return;

        if (showLoader) {
            setLoading(true);
        }

        try {
            const response = await fetch(`${API_URL}/api/quotes/sign/${token}`);
            let payload: any = null;

            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok) {
                throw new Error(
                    payload?.message ||
                    (response.status === 404
                        ? 'Devis introuvable ou lien expiré'
                        : 'Erreur lors du chargement du devis'),
                );
            }

            syncQuoteState(payload as PublicQuote);
        } catch (err: any) {
            setError(err.message || 'Erreur lors du chargement du devis');
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, [syncQuoteState, token]);

    useEffect(() => {
        loadQuote();
    }, [loadQuote]);

    const revealCgvSection = useCallback(() => {
        setCgvExpanded(true);
        requestAnimationFrame(() => {
            document.getElementById('cgv')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, []);

    const handleSign = async () => {
        if (!token || !signedBy || !signerEmail || !consentAccepted) return;
        if (quote?.terms_and_conditions && !cgvAccepted) return;

        setSigning(true);
        try {
            const response = await fetch(`${API_URL}/api/quotes/sign/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signer_name: signedBy,
                    signer_email: signerEmail,
                    cgv_accepted: cgvAccepted,
                    consent_accepted: consentAccepted,
                }),
            });

            if (!response.ok) {
                if (response.status === 403) {
                    const errorPayload = await response.json().catch(() => null);
                    await loadQuote(false);
                    setError(
                        errorPayload?.message ||
                        'Le lien de signature a expiré. Vous pouvez encore consulter le devis et télécharger le PDF.',
                    );
                    return;
                }
                const errorPayload = await response.json().catch(() => null);
                throw new Error(errorPayload?.message || 'Erreur lors de la signature');
            }

            const data: SignQuoteResponse = await response.json();
            syncQuoteState(data.quote);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSigning(false);
        }
    };

    const handleRefuse = async () => {
        if (!token) return;
        
        setSigning(true);
        try {
            const response = await fetch(`${API_URL}/api/quotes/refuse/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: refusalReason || undefined,
                }),
            });

            if (!response.ok) {
                if (response.status === 403) {
                    const errorPayload = await response.json().catch(() => null);
                    await loadQuote(false);
                    setError(
                        errorPayload?.message ||
                        'Le lien de signature a expiré. Vous pouvez encore consulter le devis et télécharger le PDF.',
                    );
                    return;
                }
                const errorPayload = await response.json().catch(() => null);
                throw new Error(errorPayload?.message || 'Erreur lors du refus');
            }

            const data: RefuseQuoteResponse = await response.json();
            syncQuoteState(data.quote);
            setRefusalReason('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSigning(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/quotes/pdf/${token}`);
            if (!response.ok) throw new Error('Erreur lors du téléchargement');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quote?.quote_number || 'devis'}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message);
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement du devis...</p>
                </div>
            </div>
        );
    }

    if (error && !quote) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Erreur</h2>
                        <p className="text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!quote) {
        return null;
    }

    const isExpiredToken = quote.is_signature_link_expired;
    const isExpired = new Date(quote.validity_date) < new Date();
    const isYousignQuote = quote.signature_provider === 'yousign';
    const isQuoteSigned = signed || ['accepted', 'signed', 'converted'].includes(quote.status);
    const isQuoteRefused = refused || quote.status === 'refused';
    const canRespond = quote.can_sign && quote.can_refuse && !isExpired && !isQuoteSigned && !isQuoteRefused;
    /** Anciens devis « fournisseur externe » : consultation / PDF uniquement */
    const canRespondInternal = canRespond && !isYousignQuote;
    const hasTermsSnapshot = quote.has_terms_snapshot;
    const clientName = quote.client.company_name
        || [quote.client.first_name, quote.client.last_name].filter(Boolean).join(' ')
        || 'Client';
    const clientAddress = [quote.client.address, quote.client.postal_code, quote.client.city]
        .filter(Boolean)
        .join(', ');

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3 text-red-800">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isExpiredToken && (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3 text-orange-900">
                                <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <h2 className="font-semibold">Devis expiré</h2>
                                    <p className="text-sm text-orange-800">
                                        Le lien de signature a expiré. Vous pouvez toujours consulter ce devis et télécharger son PDF,
                                        mais il n'est plus possible de le signer ou de le refuser.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isYousignQuote && !isQuoteSigned && !isQuoteRefused && (
                    <Card className="border-slate-200 bg-slate-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3 text-slate-800">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <h2 className="font-semibold">Signature via ce lien indisponible</h2>
                                    <p className="text-sm text-slate-700">
                                        Ce devis a été envoyé via un ancien parcours de signature. Vous pouvez consulter le document et
                                        télécharger le PDF ; pour signer ou refuser, contactez l&apos;entreprise émettrice.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* En-tête */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {quote.company.logo_url ? (
                                    <img 
                                        src={quote.company.logo_url} 
                                        alt={quote.company.name}
                                        className="h-16 w-16 object-contain"
                                    />
                                ) : (
                                    <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
                                        <Building className="h-8 w-8 text-primary-foreground" />
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold">{quote.company.name}</h1>
                                    {quote.company.address && (
                                        <p className="text-sm text-muted-foreground">
                                            {quote.company.address}, {quote.company.postal_code} {quote.company.city}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold">Devis {quote.quote_number}</h2>
                                <p className="text-sm text-muted-foreground">
                                    Émis le {formatDate(quote.issue_date)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Valide jusqu'au {formatDate(quote.validity_date)}
                                </p>
                                {isQuoteSigned && (
                                    <Badge className="mt-2 bg-green-100 text-green-800">
                                        <CheckCircle className="mr-1 h-3 w-3" />
                                        {quote.status === 'converted' ? 'Signé et converti' : 'Signé'}
                                    </Badge>
                                )}
                                {refused && (
                                    <Badge className="mt-2 bg-red-100 text-red-800">
                                        <XCircle className="mr-1 h-3 w-3" />
                                        Refusé
                                    </Badge>
                                )}
                                {isExpired && !signed && !refused && (
                                    <Badge className="mt-2 bg-orange-100 text-orange-800">
                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                        Expiré
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Client */}
                <Card>
                    <CardHeader>
                        <CardTitle>Client</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">{clientName}</p>
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
                        {clientAddress && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {clientAddress}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Objet */}
                {quote.subject && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Objet</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>{quote.subject}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Articles */}
                <Card>
                    <CardHeader>
                        <CardTitle>Détail du devis</CardTitle>
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
                                    const rows = groupItemsForReadOnly(quote.items, (item) => item.product_id);
                                    return rows.map((row) => {
                                        if (row.type === 'single') {
                                            const item = row.item;
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.description}</TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                                    <TableCell className="text-right">{item.vat_rate}%</TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(item.total_ht ?? (item.quantity * item.unit_price))}
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
                                                        <TableRow key={item.id} className="bg-muted/30">
                                                            <TableCell className="pl-6">{item.description}</TableCell>
                                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                                            <TableCell className="text-right">{item.vat_rate}%</TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {formatCurrency(item.total_ht ?? (item.quantity * item.unit_price))}
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

                {/* Totaux */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Sous-total HT</span>
                                    <span>{formatCurrency(quote.subtotal)}</span>
                                </div>
                                {(quote.discount_amount || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Remise {quote.discount_type === 'percentage' ? `(${quote.discount_value}%)` : ''}</span>
                                        <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                                    </div>
                                )}
                                {!quote.company?.is_vat_exempt && (
                                <div className="flex justify-between text-sm">
                                    <span>TVA</span>
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
                                {(quote.deposit_percent || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-blue-600 pt-2">
                                        <span>Acompte ({quote.deposit_percent}%)</span>
                                        <span>{formatCurrency(quote.deposit_amount || 0)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notes et conditions */}
                {(quote.notes || quote.terms_and_conditions || !hasTermsSnapshot) && (
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            {quote.notes && (
                                <div>
                                    <p className="font-medium mb-1">Notes</p>
                                    <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                        {quote.notes}
                                    </p>
                                </div>
                            )}
                            {quote.notes && (quote.terms_and_conditions || !hasTermsSnapshot) && <Separator />}
                            {quote.terms_and_conditions && (
                                <div>
                                    <div
                                        id="cgv"
                                        className="rounded-lg border border-slate-200 bg-slate-50"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setCgvExpanded((current) => !current)}
                                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-900">Conditions générales</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {cgvExpanded
                                                        ? 'Masquer le texte complet'
                                                        : 'Voir les conditions générales jointes à ce devis'}
                                                </p>
                                            </div>
                                            {cgvExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            )}
                                        </button>
                                        {cgvExpanded && (
                                            <div className="border-t border-slate-200 px-4 py-4">
                                                <p className="text-sm text-justify text-muted-foreground whitespace-pre-line">
                                                    {quote.terms_and_conditions}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!hasTermsSnapshot && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Ce devis a été envoyé sans CGV attachées. Aucune acceptation spécifique des CGV n’est requise pour ce document.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                {canRespondInternal && !showSignatureForm && !showRefusalForm && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button
                                        onClick={() => setShowSignatureForm(true)}
                                        size="lg"
                                        disabled={signing}
                                    >
                                        {signing ? (
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        ) : (
                                            <CheckCircle className="mr-2 h-5 w-5" />
                                        )}
                                        Accepter et signer
                                    </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowRefusalForm(true)}
                                    size="lg"
                                >
                                    <XCircle className="mr-2 h-5 w-5" />
                                    Refuser
                                </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-center">
                            <Button variant="outline" onClick={handleDownloadPdf} size="lg">
                                <Download className="mr-2 h-5 w-5" />
                                Télécharger PDF
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Formulaire de signature */}
                {showSignatureForm && canRespondInternal && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PenLine className="h-5 w-5" />
                                Signature électronique
                            </CardTitle>
                            <CardDescription>
                                En signant ce devis, vous acceptez les conditions mentionnées ci-dessus.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="signedBy">Nom du signataire *</Label>
                                <Input
                                    id="signedBy"
                                    value={signedBy}
                                    onChange={(e) => setSignedBy(e.target.value)}
                                    placeholder="Prénom et nom"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signerEmail">Email du signataire *</Label>
                                <Input
                                    id="signerEmail"
                                    type="email"
                                    value={signerEmail}
                                    onChange={(e) => setSignerEmail(e.target.value)}
                                    placeholder="email@exemple.com"
                                />
                            </div>
                            {hasTermsSnapshot && (
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="cgvAccepted"
                                        checked={cgvAccepted}
                                        onChange={(e) => setCgvAccepted(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor="cgvAccepted" className="text-sm font-normal cursor-pointer">
                                        J'ai lu et j'accepte les{' '}
                                        <button
                                            type="button"
                                            onClick={revealCgvSection}
                                            className="inline p-0 text-primary underline"
                                        >
                                            conditions générales de vente
                                        </button>
                                        . *
                                    </Label>
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="consentAccepted"
                                    checked={consentAccepted}
                                    onChange={(e) => setConsentAccepted(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="consentAccepted" className="text-sm font-normal cursor-pointer">
                                    Je reconnais avoir pris connaissance de ce devis et l'accepte dans son intégralité. *
                                </Label>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowSignConfirm(true)}
                                    disabled={
                                        signing ||
                                        !signedBy ||
                                        !signerEmail ||
                                        !consentAccepted ||
                                        (hasTermsSnapshot && !cgvAccepted)
                                    }
                                >
                                    {signing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {signing ? 'Signature en cours...' : 'Signer le devis'}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowSignatureForm(false)}
                                >
                                    Annuler
                                </Button>
                            </div>

                            <ConfirmationDialog
                                open={showSignConfirm}
                                onConfirm={() => { setShowSignConfirm(false); handleSign(); }}
                                onCancel={() => setShowSignConfirm(false)}
                                title="Confirmer la signature"
                                description="En signant ce devis, vous acceptez l'ensemble des conditions mentionnées, y compris les conditions générales de vente. Cette action est définitive."
                                confirmLabel="Signer"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Formulaire de refus */}
                {showRefusalForm && canRespondInternal && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <XCircle className="h-5 w-5" />
                                Refuser le devis
                            </CardTitle>
                            <CardDescription>
                                Vous pouvez optionnellement indiquer la raison de votre refus.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="refusalReason">Raison du refus (optionnel)</Label>
                                <Textarea
                                    id="refusalReason"
                                    value={refusalReason}
                                    onChange={(e) => setRefusalReason(e.target.value)}
                                    placeholder="Indiquez la raison de votre refus..."
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button 
                                    onClick={() => setShowRefuseConfirm(true)}
                                    variant="destructive"
                                    disabled={signing}
                                >
                                    {signing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <XCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {signing ? 'Envoi...' : 'Confirmer le refus'}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowRefusalForm(false)}
                                >
                                    Annuler
                                </Button>
                            </div>

                            <ConfirmationDialog
                                open={showRefuseConfirm}
                                onConfirm={() => { setShowRefuseConfirm(false); handleRefuse(); }}
                                onCancel={() => setShowRefuseConfirm(false)}
                                title="Confirmer le refus"
                                description="Êtes-vous sûr de vouloir refuser ce devis ? Le prestataire sera informé de votre décision."
                                confirmLabel="Refuser le devis"
                                variant="destructive"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Message de succès après signature */}
                {isQuoteSigned && (
                    <Card className="border-green-200 bg-green-50">
                        <CardContent className="pt-6 text-center">
                            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-green-800 mb-2">Devis accepté !</h2>
                            <p className="text-green-700">
                                {quote.status === 'converted'
                                    ? 'Merci pour votre confiance. Le devis a été signé et une facture a été générée.'
                                    : 'Merci pour votre confiance. Vous allez recevoir une confirmation par email.'}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Message après refus */}
                {refused && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6 text-center">
                            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-red-800 mb-2">Devis refusé</h2>
                            <p className="text-red-700">
                                Le prestataire a été informé de votre décision.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
