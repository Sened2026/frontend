import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Briefcase, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { EnterpriseLookupField } from '@/components/shared/EnterpriseLookupField';
import { BusinessIdentityFields } from '@/components/shared/BusinessIdentityFields';
import type { CreateCompanyData, SirenSearchResult } from '@/types';
import type { PrefillableField } from '@/hooks/useEnterpriseLookup';
import { cn } from '@/lib/utils';

const DEFAULT_FORM_DATA: CreateCompanyData = {
    name: '',
    owner_role: 'merchant_admin',
    legal_name: '',
    siren: '',
    vat_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'FR',
    website: '',
    default_vat_rate: 20,
    default_payment_terms: 30,
    quote_validity_days: 30,
};

interface CompanyCreateFormProps {
    formId?: string;
    hideActions?: boolean;
    isSubmitting?: boolean;
    submitDisabled?: boolean;
    submitLabel?: string;
    initialData?: Partial<CreateCompanyData>;
    lockedOwnerRole?: CreateCompanyData['owner_role'];
    onCancel?: () => void;
    onSubmit: (data: CreateCompanyData) => Promise<void> | void;
}

function normalizeCompanyData(data: CreateCompanyData): CreateCompanyData {
    const normalizedEntries = Object.entries(data).map(([key, value]) => {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return [key, trimmed === '' ? undefined : trimmed];
        }

        return [key, value];
    });

    return Object.fromEntries(normalizedEntries) as CreateCompanyData;
}

export function CompanyCreateForm({
    formId,
    hideActions = false,
    isSubmitting = false,
    submitDisabled = false,
    submitLabel = 'Créer l\'entreprise',
    initialData,
    lockedOwnerRole,
    onCancel,
    onSubmit,
}: CompanyCreateFormProps) {
    const { toast } = useToast();
    const initialDataKey = useMemo(
        () => JSON.stringify(initialData || null),
        [initialData],
    );
    const [formData, setFormData] = useState<CreateCompanyData>({
        ...DEFAULT_FORM_DATA,
        ...initialData,
        owner_role: lockedOwnerRole || initialData?.owner_role || DEFAULT_FORM_DATA.owner_role,
    });
    const [prefilledFields, setPrefilledFields] = useState<Set<PrefillableField>>(new Set());
    const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>();

    useEffect(() => {
        setFormData({
            ...DEFAULT_FORM_DATA,
            ...initialData,
            owner_role: lockedOwnerRole || initialData?.owner_role || DEFAULT_FORM_DATA.owner_role,
        });
        setPrefilledFields(new Set());
        setSelectedCompanyName(initialData?.name);
    }, [initialDataKey, lockedOwnerRole]);

    const handleInputChange = (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { name, value } = event.target;
        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleNumberInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((previous) => ({
            ...previous,
            [name]: value === '' ? undefined : Number(value),
        }));
    };

    const handleFieldChange = (field: string, value: string) => {
        setFormData((previous) => ({ ...previous, [field]: value }));
    };

    const handleSirenSelect = (result: SirenSearchResult) => {
        setFormData((previous) => ({
            ...previous,
            name: result.company_name || previous.name,
            legal_name: result.company_name || previous.legal_name,
            siren: result.siren || previous.siren,
            vat_number: result.vat_number || previous.vat_number,
            address: result.address || previous.address,
            city: result.city || previous.city,
            postal_code: result.postal_code || previous.postal_code,
            country: result.country_code || previous.country || 'FR',
        }));
        setSelectedCompanyName(result.company_name);
        toast({
            title: 'Entreprise sélectionnée',
            description: `Les informations de ${result.company_name} ont été pré-remplies.`,
        });
    };

    const handleSirenClear = () => {
        setPrefilledFields(new Set());
        setSelectedCompanyName(undefined);
        setFormData((previous) => ({
            ...previous,
            legal_name: '',
            siren: '',
            vat_number: '',
            address: '',
            city: '',
            postal_code: '',
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await onSubmit(normalizeCompanyData(formData));
    };

    return (
        <form id={formId} onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <h3 className="font-medium">Type d&apos;entreprise</h3>
                    <p className="text-sm text-muted-foreground">
                        Choisissez le rôle propriétaire à créer avec cette société.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {[
                        {
                            value: 'merchant_admin',
                            title: 'Entreprise marchande',
                            description: 'Gestion commerciale classique avec rôle propriétaire administrateur.',
                            icon: Building2,
                        },
                        {
                            value: 'accountant',
                            title: 'Cabinet comptable',
                            description: 'Cabinet avec rôle propriétaire expert-comptable.',
                            icon: Briefcase,
                        },
                    ].map((option) => {
                        const isSelected = formData.owner_role === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    if (lockedOwnerRole) {
                                        return;
                                    }

                                    setFormData((previous) => ({
                                        ...previous,
                                        owner_role: option.value as CreateCompanyData['owner_role'],
                                    }));
                                }}
                                className={cn(
                                    'rounded-xl border p-4 text-left transition-colors',
                                    isSelected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/40 hover:bg-muted/40',
                                    lockedOwnerRole && 'cursor-default',
                                )}
                            >
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                    <option.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="font-medium">{option.title}</div>
                                {option.value !== 'accountant' && (
                                    <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Recherche SIREN */}
            <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Recherche SIREN / SIRET
                </h3>
                <EnterpriseLookupField
                    mode="authenticated"
                    onSelect={handleSirenSelect}
                    onClear={handleSirenClear}
                    selectedName={selectedCompanyName}
                />
            </div>

            <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Informations générales
                </h3>

                <BusinessIdentityFields
                    variant="company"
                    values={formData}
                    prefilledFields={prefilledFields}
                    onChange={handleFieldChange}
                    disabled={isSubmitting}
                />
            </div>

            <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Coordonnées
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email || ''}
                            onChange={handleInputChange}
                            placeholder="contact@masociete.fr"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone</Label>
                        <Input
                            id="phone"
                            name="phone"
                            value={formData.phone || ''}
                            onChange={handleInputChange}
                            placeholder="01 23 45 67 89"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="website">Site web</Label>
                    <Input
                        id="website"
                        name="website"
                        value={formData.website || ''}
                        onChange={handleInputChange}
                        placeholder="https://www.masociete.fr"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Paramètres par défaut
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="default_vat_rate">Taux TVA (%)</Label>
                        <Input
                            id="default_vat_rate"
                            name="default_vat_rate"
                            type="number"
                            value={formData.default_vat_rate ?? 20}
                            onChange={handleNumberInputChange}
                            min={0}
                            max={100}
                            step={0.1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="default_payment_terms">Délai paiement (j)</Label>
                        <Input
                            id="default_payment_terms"
                            name="default_payment_terms"
                            type="number"
                            value={formData.default_payment_terms ?? 30}
                            onChange={handleNumberInputChange}
                            min={0}
                            max={365}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quote_validity_days">Validité devis (j)</Label>
                        <Input
                            id="quote_validity_days"
                            name="quote_validity_days"
                            type="number"
                            value={formData.quote_validity_days ?? 30}
                            onChange={handleNumberInputChange}
                            min={1}
                            max={365}
                        />
                    </div>
                </div>
            </div>

            {!hideActions && (
                <div className="flex justify-end gap-3">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                            Annuler
                        </Button>
                    )}
                    <Button type="submit" disabled={isSubmitting || submitDisabled}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitLabel}
                    </Button>
                </div>
            )}
        </form>
    );
}
