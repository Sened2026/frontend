import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Send, PlusCircle, Tag, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { ClientCreateDialog } from '@/components/clients/ClientCreateDialog';
import { quoteService, clientService, legalService, productService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import type { Client, Product, CreateQuoteData } from '@/types';
import {
    findLastMergeableSingleItemIndex,
    findTrailingMergeableMultiTaxGroup,
    getCatalogProductLines,
    groupItemsForDisplay,
    isDraftItemForProductSelection,
} from '@/lib/multi-tax-utils';

const FR_VAT_RATES = [20, 10, 5.5, 2.1, 0] as const;

type DiscountType = 'percentage' | 'fixed';

interface QuoteItemFormData {
    id?: string;
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    discount_value: number;
    discount_type: DiscountType;
}

export function QuoteCreate() {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Dialog pour nouveau produit
    const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
    const [newProductItemIndex, setNewProductItemIndex] = useState<number | null>(null);
    const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
    const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
    const [cgvAccepted, setCgvAccepted] = useState(false);

    // Form state
    const [clientId, setClientId] = useState<string>('');
    const [validUntil, setValidUntil] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [termsAndConditions, setTermsAndConditions] = useState<string>('');
    const [defaultTermsAndConditions, setDefaultTermsAndConditions] = useState<string>('');
    const [hasDefaultTerms, setHasDefaultTerms] = useState(false);
    const [discountValue, setDiscountValue] = useState<number>(0);
    const [discountType, setDiscountType] = useState<DiscountType>('percentage');
    const [depositValue, setDepositValue] = useState<number>(0);
    const [depositType, setDepositType] = useState<DiscountType>('percentage');
    const [items, setItems] = useState<QuoteItemFormData[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const displayRows = useMemo(
        () => groupItemsForDisplay(items, products),
        [items, products],
    );
    const hasQuoteTerms = Boolean(termsAndConditions.trim());
    const hasPublishedCompanyTerms = hasDefaultTerms;
    const requiresTermsConfirmation = hasQuoteTerms;
    const requiresNoTermsConfirmation = !hasQuoteTerms && !hasPublishedCompanyTerms;

    const toggleGroup = useCallback((key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const removeMultiTaxGroup = useCallback((startIndex: number, count: number) => {
        setItems(prev => [...prev.slice(0, startIndex), ...prev.slice(startIndex + count)]);
    }, []);

    const updateGroupQuantity = useCallback((startIndex: number, count: number, qty: number) => {
        setItems(prev => {
            const next = [...prev];
            for (let i = startIndex; i < startIndex + count; i++) {
                next[i] = { ...next[i], quantity: qty };
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!currentCompany) return;
            setLoading(true);
            try {
                const [clientsRes, productsRes, legalDocumentsRes] = await Promise.all([
                    clientService.getAll(currentCompany.id, { limit: 100 }),
                    productService.getAll(currentCompany.id, { limit: 100, is_active: true }),
                    legalService.getCompanyDocuments(currentCompany.id).catch(() => null),
                ]);
                setClients(clientsRes.clients);
                setProducts(productsRes.products);

                const publishedSalesTerms = legalDocumentsRes?.documents
                    ?.find((document) => document.document_type === 'sales_terms')
                    ?.published_version?.content_text
                    ?.trim() || currentCompany.terms_and_conditions?.trim() || '';

                setDefaultTermsAndConditions(publishedSalesTerms);
                setHasDefaultTerms(Boolean(publishedSalesTerms));

                // Set default validity date (30 days from now)
                const defaultValidity = new Date();
                defaultValidity.setDate(defaultValidity.getDate() + (currentCompany.quote_validity_days || 30));
                setValidUntil(defaultValidity.toISOString().split('T')[0]);

                // Set default terms
                if (publishedSalesTerms) {
                    setTermsAndConditions(publishedSalesTerms);
                }

                // Load quote if editing
                if (id) {
                    const quote = await quoteService.getById(currentCompany.id, id);
                    setClientId(quote.client_id);
                    setValidUntil(quote.validity_date.split('T')[0]);
                    setSubject(quote.subject || '');
                    setNotes(quote.notes || '');
                    setTermsAndConditions(quote.terms_and_conditions || publishedSalesTerms || '');
                    setDiscountValue(quote.discount_value || 0);
                    setDiscountType(quote.discount_type || 'percentage');
                    if (quote.items) {
                        setItems(quote.items.map(item => ({
                            id: item.id,
                            product_id: item.product_id || undefined,
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            vat_rate: item.vat_rate,
                            discount_value: item.discount_value || 0,
                            discount_type: (item.discount_type as DiscountType) || 'percentage',
                        })));
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erreur',
                    description: 'Impossible de charger les données',
                });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentCompany, id]);

    const addItem = () => {
        setItems([...items, {
            description: '',
            quantity: 1,
            unit_price: 0,
            vat_rate: currentCompany?.default_vat_rate ?? 20,
            discount_value: 0,
            discount_type: 'percentage',
        }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = useCallback((index: number, field: keyof QuoteItemFormData, value: any) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    }, []);

    const updateItemNumeric = useCallback((index: number, field: keyof QuoteItemFormData, stringValue: string) => {
        const numValue = stringValue === '' ? 0 : parseFloat(stringValue.replace(',', '.'));
        if (!isNaN(numValue)) {
            setItems(prevItems => {
                const newItems = [...prevItems];
                newItems[index] = { ...newItems[index], [field]: numValue };
                return newItems;
            });
        }
    }, []);

    const applyProductToItems = useCallback((
        prevItems: QuoteItemFormData[],
        index: number,
        product: Product,
    ): { nextItems: QuoteItemFormData[]; expandedGroupKey?: string } => {
        const catalogLines = getCatalogProductLines(product);
        const currentItem = prevItems[index];
        const defaultVatRate = currentCompany?.default_vat_rate ?? 20;
        const canMergeIntoExisting = Boolean(
            currentItem && isDraftItemForProductSelection(currentItem, defaultVatRate),
        );

        if (catalogLines.length > 1) {
            const trailingGroup = canMergeIntoExisting
                ? findTrailingMergeableMultiTaxGroup(prevItems, product, index)
                : null;

            const newLines: QuoteItemFormData[] = catalogLines.map((line) => ({
                ...line,
            }));

            return {
                nextItems: [
                    ...prevItems.slice(0, index),
                    ...newLines,
                    ...prevItems.slice(index + 1),
                ],
                expandedGroupKey: `${product.id}-${trailingGroup?.startIndex ?? index}`,
            };
        }

        if (canMergeIntoExisting) {
            const mergeIndex = findLastMergeableSingleItemIndex(prevItems, product, index);
            if (mergeIndex !== -1) {
                const nextItems = prevItems
                    .filter((_, itemIndex) => itemIndex !== index)
                    .map((item, itemIndex) => {
                        const normalizedMergeIndex = mergeIndex > index ? mergeIndex - 1 : mergeIndex;
                        if (itemIndex !== normalizedMergeIndex) {
                            return item;
                        }

                        return {
                            ...item,
                            quantity: item.quantity + 1,
                        };
                    });

                return { nextItems };
            }
        }

        const [catalogLine] = catalogLines;
        const nextItems = [...prevItems];
        nextItems[index] = {
            ...nextItems[index],
            ...catalogLine,
        };

        return { nextItems };
    }, [currentCompany?.default_vat_rate]);

    const handleProductSelect = (index: number, productId: string) => {
        if (productId === '__new__') {
            // Ouvrir le dialog pour créer un nouveau produit
            setNewProductItemIndex(index);
            setNewProductDialogOpen(true);
            return;
        }

        const product = products.find(p => p.id === productId);
        if (product) {
            const { nextItems, expandedGroupKey } = applyProductToItems(items, index, product);
            setItems(nextItems);
            if (expandedGroupKey) {
                setExpandedGroups(prev => new Set(prev).add(expandedGroupKey));
            }
        }
    };

    const handleProductCreated = (newProduct: Product) => {
        // Ajouter le produit à la liste
        setProducts(prev => [...prev, newProduct]);

        // Mettre à jour l'article avec le nouveau produit
        if (newProductItemIndex !== null) {
            const { nextItems, expandedGroupKey } = applyProductToItems(items, newProductItemIndex, newProduct);
            setItems(nextItems);
            if (expandedGroupKey) {
                setExpandedGroups(prev => new Set(prev).add(expandedGroupKey));
            }
        }

        setNewProductItemIndex(null);
    };

    const handleClientCreated = (newClient: Client) => {
        setClients(prev => [...prev, newClient]);
        setClientId(newClient.id);
    };

    const calculateItemTotal = (item: QuoteItemFormData) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_type === 'percentage' 
            ? subtotal * (item.discount_value / 100)
            : item.discount_value;
        return Math.max(0, subtotal - discount);
    };

    const calculateTotals = () => {
        const subtotalHT = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
        const globalDiscount = discountType === 'percentage'
            ? subtotalHT * (discountValue / 100)
            : discountValue;
        const subtotalAfterDiscount = Math.max(0, subtotalHT - globalDiscount);
        const totalVAT = items.reduce((sum, item) => {
            const itemTotal = calculateItemTotal(item);
            const itemProportion = subtotalHT > 0 ? itemTotal / subtotalHT : 0;
            const itemAfterDiscount = subtotalAfterDiscount * itemProportion;
            return sum + (itemAfterDiscount * (item.vat_rate / 100));
        }, 0);
        const totalTTC = subtotalAfterDiscount + totalVAT;
        const deposit = depositType === 'percentage'
            ? totalTTC * (depositValue / 100)
            : depositValue;

        return {
            subtotalHT,
            globalDiscount,
            subtotalAfterDiscount,
            totalVAT,
            totalTTC,
            deposit,
        };
    };

    const handleSubmit = async (sendAfterSave: boolean = false) => {
        if (!currentCompany) return;

        if (!clientId) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Veuillez sélectionner un client',
            });
            return;
        }

        if (items.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Veuillez ajouter au moins un article',
            });
            return;
        }

        if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Veuillez remplir correctement tous les articles',
            });
            return;
        }

        setSaving(true);
        try {
            const quoteData: CreateQuoteData = {
                client_id: clientId,
                validity_date: validUntil,
                subject: subject || undefined,
                notes: notes || undefined,
                terms_and_conditions: termsAndConditions || undefined,
                discount_type: discountValue > 0 ? discountType : undefined,
                discount_value: discountValue > 0 ? discountValue : undefined,
                items: items.map((item, index) => ({
                    product_id: item.product_id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    vat_rate: item.vat_rate,
                    discount_type: item.discount_value > 0 ? item.discount_type : undefined,
                    discount_value: item.discount_value > 0 ? item.discount_value : undefined,
                    position: index,
                })),
            };

            let savedQuote;
            if (isEditing && id) {
                savedQuote = await quoteService.update(currentCompany.id, id, quoteData);
            } else {
                savedQuote = await quoteService.create(currentCompany.id, quoteData);
            }

            if (sendAfterSave && savedQuote.id) {
                const sendResponse = await quoteService.send(currentCompany.id, savedQuote.id, {
                    confirm_send_without_cgv: requiresNoTermsConfirmation || undefined,
                });
                toast({
                    title: 'Devis envoyé',
                    description: 'Le devis a été créé et envoyé au client',
                });
                if (sendResponse.warnings?.length) {
                    sendResponse.warnings.forEach((w: string) => toast({ title: 'Avertissement', description: w }));
                }
            } else {
                toast({
                    title: isEditing ? 'Devis mis à jour' : 'Devis créé',
                    description: isEditing ? 'Le devis a été mis à jour avec succès' : 'Le devis a été créé avec succès',
                });
            }

            navigate(`/quotes/${savedQuote.id}`);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de sauvegarder le devis',
            });
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const totals = calculateTotals();

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Skeleton className="h-8 w-48" />
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">
                        {isEditing ? 'Modifier le devis' : 'Nouveau devis'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing ? 'Modifiez les informations du devis' : 'Créez un nouveau devis pour votre client'}
                    </p>
                </div>
            </div>

            {/* Informations générales */}
            <Card>
                <CardHeader>
                    <CardTitle>Informations générales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="client">Client *</Label>
                            <Select
                                value={clientId}
                                onValueChange={(value) => {
                                    if (value === '__new__') {
                                        setNewClientDialogOpen(true);
                                        return;
                                    }
                                    setClientId(value);
                                }}
                            >
                                <SelectTrigger id="client">
                                    <SelectValue placeholder="Sélectionner un client" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__new__">
                                        <span className="flex items-center gap-2 text-primary">
                                            <PlusCircle className="h-4 w-4" />
                                            Créer un client
                                        </span>
                                    </SelectItem>
                                    {clients.length > 0 && (
                                        <div className="my-1 border-t" />
                                    )}
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.company_name || `${client.first_name} ${client.last_name}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="validUntil">Date de validité *</Label>
                            <Input
                                id="validUntil"
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="subject">Objet</Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ex: Prestation de services"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Articles */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Articles</CardTitle>
                    <Button onClick={addItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un article
                    </Button>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Aucun article. Cliquez sur "Ajouter un article" pour commencer.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Produit</TableHead>
                                        <TableHead className="min-w-[150px]">Description</TableHead>
                                        <TableHead className="w-[80px] text-center">Qté</TableHead>
                                        <TableHead className="w-[110px]">Prix HT</TableHead>
                                        <TableHead className="w-[90px] text-center">TVA %</TableHead>
                                        <TableHead className="w-[110px] text-right">Total HT</TableHead>
                                        <TableHead className="w-[110px] text-right">Total TTC</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayRows.map((row) => {
                                        if (row.type === 'single') {
                                            const item = row.item;
                                            const index = row.index;
                                            const isInactiveProduct = item.product_id && !products.find(p => p.id === item.product_id);
                                            return (
                                                <TableRow key={`single-${index}`}>
                                                    <TableCell>
                                                        <Select
                                                            value={item.product_id || ''}
                                                            onValueChange={(value) => handleProductSelect(index, value)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={isInactiveProduct ? 'Produit inactif' : 'Choisir'} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__new__">
                                                                    <span className="flex items-center gap-2 text-primary">
                                                                        <PlusCircle className="h-4 w-4" />
                                                                        Créer un produit
                                                                    </span>
                                                                </SelectItem>
                                                                {products.length > 0 && (
                                                                    <div className="my-1 border-t" />
                                                                )}
                                                                {products.map((product) => (
                                                                    <SelectItem key={product.id} value={product.id}>
                                                                        {product.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={item.description}
                                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                            placeholder="Description"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <NumericInput
                                                            value={item.quantity}
                                                            onValueChange={(value) => updateItem(index, 'quantity', value)}
                                                            className="w-[70px] text-center"
                                                            min="0"
                                                            step="1"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <NumericInput
                                                            value={item.unit_price}
                                                            onValueChange={(value) => updateItem(index, 'unit_price', value)}
                                                            className="w-[100px]"
                                                            min="0"
                                                            step="0.01"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={String(item.vat_rate)}
                                                            onValueChange={(v) => {
                                                                const newItems = [...items];
                                                                newItems[index] = { ...newItems[index], vat_rate: parseFloat(v) };
                                                                setItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-[80px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {FR_VAT_RATES.map((rate) => (
                                                                    <SelectItem key={rate} value={String(rate)}>
                                                                        {rate}%
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {item.discount_value > 0 && (
                                                                <span className="text-xs text-green-600 mr-1">
                                                                    -{item.discount_type === 'percentage' ? `${item.discount_value}%` : formatCurrency(item.discount_value)}
                                                                </span>
                                                            )}
                                                            <span className="font-medium">{formatCurrency(calculateItemTotal(item))}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-medium">
                                                            {formatCurrency(calculateItemTotal(item) * (1 + item.vat_rate / 100))}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant={item.discount_value > 0 ? "default" : "ghost"}
                                                                        size="icon"
                                                                        className={item.discount_value > 0 ? "h-8 w-8 bg-green-600 hover:bg-green-700" : "h-8 w-8"}
                                                                        title="Ajouter une remise"
                                                                    >
                                                                        <Tag className="h-4 w-4" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-64" align="end">
                                                                    <div className="space-y-3">
                                                                        <div className="font-medium text-sm">Remise sur l'article</div>
                                                                        <div className="flex items-center gap-2">
                                                                            <NumericInput
                                                                                value={item.discount_value}
                                                                                onValueChange={(value) => updateItem(index, 'discount_value', value)}
                                                                                className="flex-1"
                                                                                placeholder="Valeur"
                                                                                min="0"
                                                                                max={item.discount_type === 'percentage' ? 100 : undefined}
                                                                                step="0.01"
                                                                            />
                                                                            <Select
                                                                                value={item.discount_type}
                                                                                onValueChange={(value: DiscountType) => updateItem(index, 'discount_type', value)}
                                                                            >
                                                                                <SelectTrigger className="w-[70px]">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="percentage">%</SelectItem>
                                                                                    <SelectItem value="fixed">€</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        {item.discount_value > 0 && (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="w-full"
                                                                                onClick={() => {
                                                                                    updateItemNumeric(index, 'discount_value', '0');
                                                                                }}
                                                                            >
                                                                                <X className="h-3 w-3 mr-1" />
                                                                                Supprimer la remise
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => removeItem(index)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        // Multi-tax group
                                        const groupKey = `${row.productId}-${row.startIndex}`;
                                        const isExpanded = expandedGroups.has(groupKey);
                                        const groupTotal = row.items.reduce((sum, gi) => sum + calculateItemTotal(gi.item), 0);
                                        const groupTotalTTC = row.items.reduce((sum, gi) => (
                                            sum + (calculateItemTotal(gi.item) * (1 + gi.item.vat_rate / 100))
                                        ), 0);
                                        const sharedQty = row.items[0].item.quantity;

                                        return (
                                            <React.Fragment key={`multi-${groupKey}`}>
                                                {/* Parent row */}
                                                <TableRow className="bg-muted/50">
                                                    <TableCell>
                                                        <button
                                                            type="button"
                                                            className="flex items-center gap-2 font-medium text-sm w-full text-left"
                                                            onClick={() => toggleGroup(groupKey)}
                                                        >
                                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            {row.productName}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {row.items.length} lignes TVA
                                                    </TableCell>
                                                    <TableCell>
                                                        <NumericInput
                                                            value={sharedQty}
                                                            onValueChange={(value) => updateGroupQuantity(row.startIndex, row.items.length, value)}
                                                            className="w-[70px] text-center"
                                                            min="0"
                                                            step="1"
                                                        />
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-medium">{formatCurrency(groupTotal)}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-medium">{formatCurrency(groupTotalTTC)}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => removeMultiTaxGroup(row.startIndex, row.items.length)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {/* Sub-rows */}
                                                {isExpanded && row.items.map((gi) => {
                                                    const item = gi.item;
                                                    const index = gi.index;
                                                    return (
                                                        <TableRow key={`sub-${index}`} className="bg-muted/30">
                                                            <TableCell className="pl-10"></TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    value={item.description}
                                                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                                    placeholder="Description"
                                                                />
                                                            </TableCell>
                                                            <TableCell></TableCell>
                                                            <TableCell>
                                                                <NumericInput
                                                                    value={item.unit_price}
                                                                    onValueChange={(value) => updateItem(index, 'unit_price', value)}
                                                                    className="w-[100px]"
                                                                    min="0"
                                                                    step="0.01"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={String(item.vat_rate)}
                                                                    onValueChange={(v) => {
                                                                        const newItems = [...items];
                                                                        newItems[index] = { ...newItems[index], vat_rate: parseFloat(v) };
                                                                        setItems(newItems);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-[80px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {FR_VAT_RATES.map((rate) => (
                                                                            <SelectItem key={rate} value={String(rate)}>
                                                                                {rate}%
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {item.discount_value > 0 && (
                                                                        <span className="text-xs text-green-600 mr-1">
                                                                            -{item.discount_type === 'percentage' ? `${item.discount_value}%` : formatCurrency(item.discount_value)}
                                                                        </span>
                                                                    )}
                                                                    <span className="font-medium">{formatCurrency(calculateItemTotal(item))}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <span className="font-medium">
                                                                    {formatCurrency(calculateItemTotal(item) * (1 + item.vat_rate / 100))}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant={item.discount_value > 0 ? "default" : "ghost"}
                                                                            size="icon"
                                                                            className={item.discount_value > 0 ? "h-8 w-8 bg-green-600 hover:bg-green-700" : "h-8 w-8"}
                                                                            title="Ajouter une remise"
                                                                        >
                                                                            <Tag className="h-4 w-4" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64" align="end">
                                                                        <div className="space-y-3">
                                                                            <div className="font-medium text-sm">Remise sur la ligne</div>
                                                                            <div className="flex items-center gap-2">
                                                                                <NumericInput
                                                                                    value={item.discount_value}
                                                                                    onValueChange={(value) => updateItem(index, 'discount_value', value)}
                                                                                    className="flex-1"
                                                                                    placeholder="Valeur"
                                                                                    min="0"
                                                                                    max={item.discount_type === 'percentage' ? 100 : undefined}
                                                                                    step="0.01"
                                                                                />
                                                                                <Select
                                                                                    value={item.discount_type}
                                                                                    onValueChange={(value: DiscountType) => updateItem(index, 'discount_type', value)}
                                                                                >
                                                                                    <SelectTrigger className="w-[70px]">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="percentage">%</SelectItem>
                                                                                        <SelectItem value="fixed">€</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            {item.discount_value > 0 && (
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="w-full"
                                                                                    onClick={() => updateItemNumeric(index, 'discount_value', '0')}
                                                                                >
                                                                                    <X className="h-3 w-3 mr-1" />
                                                                                    Supprimer la remise
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Remises et totaux */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="discountValue">Remise globale</Label>
                                <div className="flex gap-2">
                                    <NumericInput
                                        id="discountValue"
                                        value={discountValue}
                                        onValueChange={setDiscountValue}
                                        className="flex-1"
                                        min="0"
                                        max={discountType === 'percentage' ? 100 : undefined}
                                        step="0.01"
                                    />
                                    <Select
                                        value={discountType}
                                        onValueChange={(value: DiscountType) => setDiscountType(value)}
                                    >
                                        <SelectTrigger className="w-[70px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">%</SelectItem>
                                            <SelectItem value="fixed">€</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="depositValue">Acompte</Label>
                                <div className="flex gap-2">
                                    <NumericInput
                                        id="depositValue"
                                        value={depositValue}
                                        onValueChange={setDepositValue}
                                        min="0"
                                        max={depositType === 'percentage' ? 100 : undefined}
                                        step={depositType === 'percentage' ? '1' : '0.01'}
                                        className="flex-1"
                                    />
                                    <Select
                                        value={depositType}
                                        onValueChange={(value: DiscountType) => setDepositType(value)}
                                    >
                                        <SelectTrigger className="w-[70px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">%</SelectItem>
                                            <SelectItem value="fixed">€</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (visible sur le devis)</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notes complémentaires..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="terms">Conditions générales</Label>
                            <div
                                className={`rounded-lg border px-4 py-3 text-sm ${
                                    hasDefaultTerms
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        : 'border-amber-200 bg-amber-50 text-amber-900'
                                }`}
                            >
                                <p className="font-medium">
                                    {hasDefaultTerms
                                        ? `Une CGV par défaut est configurée pour ${currentCompany?.name || 'cette entreprise'}.`
                                        : `Aucune CGV par défaut n’est configurée pour ${currentCompany?.name || 'cette entreprise'}.`}
                                </p>
                                <p className="mt-1">
                                    Cette CGV dépend de l’entreprise actuellement sélectionnée. Ce champ reste modifiable pour ce devis uniquement et le texte envoyé au client sera figé au moment de l’envoi.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/settings/legal-documents">
                                            Gérer la CGV par défaut
                                        </Link>
                                    </Button>
                                    {hasDefaultTerms && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setTermsAndConditions(defaultTermsAndConditions)}
                                        >
                                            Réutiliser la CGV par défaut
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <Textarea
                                id="terms"
                                value={termsAndConditions}
                                onChange={(e) => setTermsAndConditions(e.target.value)}
                                placeholder={
                                    hasDefaultTerms
                                        ? 'Personnalisez ici les CGV uniquement pour ce devis'
                                        : 'Saisissez une CGV spécifique pour ce devis'
                                }
                                rows={6}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Récapitulatif</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span>Sous-total HT</span>
                            <span>{formatCurrency(totals.subtotalHT)}</span>
                        </div>
                        {totals.globalDiscount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Remise globale ({discountType === 'percentage' ? `${discountValue}%` : formatCurrency(discountValue)})</span>
                                <span>-{formatCurrency(totals.globalDiscount)}</span>
                            </div>
                        )}
                        {!currentCompany?.is_vat_exempt && (
                        <div className="flex justify-between text-sm">
                            <span>TVA</span>
                            <span>{formatCurrency(totals.totalVAT)}</span>
                        </div>
                        )}
                        <div className="border-t pt-3 flex justify-between font-bold text-lg">
                            <span>{currentCompany?.is_vat_exempt ? 'Total HT' : 'Total TTC'}</span>
                            <span>{formatCurrency(totals.totalTTC)}</span>
                        </div>
                        {currentCompany?.is_vat_exempt && (
                            <p className="text-xs text-muted-foreground">
                                {currentCompany.vat_exemption_note || 'TVA non applicable, art. 293 B du CGI'}
                            </p>
                        )}
                        {totals.deposit > 0 && (
                            <div className="flex justify-between text-sm text-blue-600 pt-2">
                                <span>
                                    Acompte à verser (
                                    {depositType === 'percentage' ? `${depositValue}%` : formatCurrency(depositValue)}
                                    )
                                </span>
                                <span>{formatCurrency(totals.deposit)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => navigate('/quotes')}>
                    Annuler
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleSubmit(false)}
                    disabled={saving}
                >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button
                    onClick={() => {
                        setCgvAccepted(false);
                        setSendConfirmOpen(true);
                    }}
                    disabled={saving}
                >
                    <Send className="mr-2 h-4 w-4" />
                    {saving ? 'Envoi...' : 'Enregistrer et envoyer'}
                </Button>
            </div>

            {/* Dialog pour créer un nouveau produit */}
            {currentCompany && (
                <ProductFormDialog
                    open={newProductDialogOpen}
                    onOpenChange={setNewProductDialogOpen}
                    companyId={currentCompany.id}
                    onSuccess={handleProductCreated}
                />
            )}
            {currentCompany && (
                <ClientCreateDialog
                    open={newClientDialogOpen}
                    onOpenChange={setNewClientDialogOpen}
                    companyId={currentCompany.id}
                    onClientCreated={handleClientCreated}
                />
            )}

            <Dialog
                open={sendConfirmOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setSendConfirmOpen(false);
                        setCgvAccepted(false);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enregistrer et envoyer ce devis ?</DialogTitle>
                        <DialogDescription>
                            Une fois envoyé, le devis passera au statut envoyé et le client recevra l’email associé.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {requiresTermsConfirmation && (
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={cgvAccepted}
                                    onChange={(e) => setCgvAccepted(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">
                                    J&apos;ai vérifié les conditions générales jointes à ce devis
                                </span>
                            </label>
                        )}
                        {requiresNoTermsConfirmation && (
                            <>
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Aucune CGV n’est disponible. Ce devis sera envoyé sans CGV attachées ni CGV entreprise publiées.
                                </div>
                                <label className="flex cursor-pointer items-center gap-2">
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
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSendConfirmOpen(false);
                                setCgvAccepted(false);
                            }}
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={() => {
                                setSendConfirmOpen(false);
                                setCgvAccepted(false);
                                handleSubmit(true);
                            }}
                            disabled={(requiresTermsConfirmation || requiresNoTermsConfirmation) && !cgvAccepted}
                        >
                            <Send className="mr-2 h-4 w-4" />
                            Confirmer l&apos;envoi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
