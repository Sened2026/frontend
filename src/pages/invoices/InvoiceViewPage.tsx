import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Building, Clock, Download, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { getApiBaseUrl } from '@/lib/api-config';
import type { Invoice } from '@/types';

const API_URL = getApiBaseUrl();

export function InvoiceViewPage() {
    const { token } = useParams<{ token: string }>();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [isExpiredToken, setIsExpiredToken] = useState(false);

    useEffect(() => {
        const loadInvoice = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/invoices/view/${token}`);
                if (!response.ok) {
                    if (response.status === 403) {
                        setIsExpiredToken(true);
                        return;
                    }
                    if (response.status === 404) {
                        throw new Error('Facture introuvable ou lien expiré');
                    }
                    throw new Error('Erreur lors du chargement de la facture');
                }
                const data = await response.json();
                setInvoice(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadInvoice();
    }, [token]);

    const handleDownloadPdf = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/invoices/pdf/${token}`);
            if (!response.ok) throw new Error('Erreur lors du téléchargement');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoice?.invoice_number || 'facture'}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    if (isExpiredToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                            <Clock className="h-8 w-8 text-orange-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Lien expiré</h2>
                        <p className="text-sm text-muted-foreground">
                            Le lien de consultation de cette facture a expiré. Veuillez contacter l'expéditeur
                            pour recevoir un nouveau lien.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement de la facture...</p>
                </div>
            </div>
        );
    }

    if (error) {
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

    if (!invoice) return null;

    const clientName = invoice.client?.company_name
        || [invoice.client?.first_name, invoice.client?.last_name].filter(Boolean).join(' ')
        || 'Client';
    const clientAddress = [invoice.client?.address, invoice.client?.postal_code, invoice.client?.city]
        .filter(Boolean)
        .join(', ');

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-center gap-4">
                                {invoice.company?.logo_url ? (
                                    <img
                                        src={invoice.company.logo_url}
                                        alt={invoice.company.name}
                                        className="h-16 w-16 object-contain"
                                    />
                                ) : (
                                    <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
                                        <Building className="h-8 w-8 text-primary-foreground" />
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-2xl font-bold">{invoice.company?.name}</h1>
                                    {invoice.company?.address && (
                                        <p className="text-sm text-muted-foreground">
                                            {invoice.company.address}, {invoice.company.postal_code} {invoice.company.city}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold">Facture {invoice.invoice_number}</h2>
                                <p className="text-sm text-muted-foreground">Émise le {formatDate(invoice.issue_date)}</p>
                                <p className="text-sm text-muted-foreground">
                                    Échéance le {formatDate(invoice.due_date)}
                                </p>
                                <Badge className="mt-2 bg-blue-100 text-blue-800">Consultation en ligne</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Client</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="font-medium">{clientName}</p>
                        {invoice.client?.email && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {invoice.client.email}
                            </p>
                        )}
                        {invoice.client?.phone && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {invoice.client.phone}
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

                <Card>
                    <CardHeader>
                        <CardTitle>Détail de la facture</CardTitle>
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
                                {(invoice.items || []).map((item, index) => (
                                    <TableRow key={item.id || `${item.description}-${index}`}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                        <TableCell className="text-right">{item.vat_rate}%</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(item.line_total ?? item.quantity * item.unit_price)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Sous-total HT</span>
                                    <span>{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {(invoice.discount_amount || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>
                                            Remise {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}
                                        </span>
                                        <span>-{formatCurrency(invoice.discount_amount || 0)}</span>
                                    </div>
                                )}
                                {!invoice.company?.is_vat_exempt && (
                                <div className="flex justify-between text-sm">
                                    <span>TVA</span>
                                    <span>{formatCurrency(invoice.total_vat)}</span>
                                </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>{invoice.company?.is_vat_exempt ? 'Total HT' : 'Total TTC'}</span>
                                    <span>{formatCurrency(invoice.total)}</span>
                                </div>
                                {invoice.company?.is_vat_exempt && (
                                    <p className="text-xs text-muted-foreground">
                                        {invoice.company.vat_exemption_note || 'TVA non applicable, art. 293 B du CGI'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {invoice.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-justify whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-center">
                            <Button onClick={handleDownloadPdf} size="lg">
                                <Download className="mr-2 h-5 w-5" />
                                Télécharger le PDF
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
