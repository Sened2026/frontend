import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/components/ui/use-toast';
import { EnterpriseLookupField } from '@/components/shared/EnterpriseLookupField';
import { getClientEmailValidationMessage, normalizeClientEmail } from '@/lib/client-validation';
import { ApiRequestError, clientService } from '@/services/api';
import type { Client, ClientType, CreateClientData, SirenSearchResult } from '@/types';

interface ClientCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    onClientCreated?: (client: Client) => void;
}

export function ClientCreateDialog({
    open,
    onOpenChange,
    companyId,
    onClientCreated,
}: ClientCreateDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [type, setType] = useState<ClientType>('professional');
    const [companyName, setCompanyName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [siren, setSiren] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>();

    const resetForm = () => {
        setType('professional');
        setCompanyName('');
        setFirstName('');
        setLastName('');
        setSiren('');
        setEmail('');
        setPhone('');
        setAddress('');
        setPostalCode('');
        setCity('');
        setNotes('');
        setSelectedCompanyName(undefined);
    };

    const handleOpenChange = (value: boolean) => {
        if (!value) {
            resetForm();
        }
        onOpenChange(value);
    };

    const handleSirenSelect = (result: SirenSearchResult) => {
        setCompanyName(result.company_name || '');
        setSiren(result.siren || '');
        setAddress(result.address || '');
        setPostalCode(result.postal_code || '');
        setCity(result.city || '');
        setSelectedCompanyName(result.company_name);
        toast({
            title: 'Entreprise sélectionnée',
            description: `Informations de ${result.company_name} pré-remplies.`,
        });
    };

    const handleSirenClear = () => {
        setCompanyName('');
        setSiren('');
        setAddress('');
        setPostalCode('');
        setCity('');
        setSelectedCompanyName(undefined);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (type === 'professional' && !companyName.trim()) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'La raison sociale est requise',
            });
            return;
        }

        if (type === 'individual' && !lastName.trim()) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Le nom est requis',
            });
            return;
        }

        const clientEmail = normalizeClientEmail(email);
        const emailValidationMessage = getClientEmailValidationMessage(clientEmail);
        if (emailValidationMessage) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: emailValidationMessage,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: CreateClientData = {
                type,
                company_name: type === 'professional' ? companyName.trim() : undefined,
                first_name: type === 'individual' ? firstName.trim() || undefined : undefined,
                last_name: type === 'individual' ? lastName.trim() : undefined,
                siren: siren.trim() || undefined,
                email: clientEmail,
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
                postal_code: postalCode.trim() || undefined,
                city: city.trim() || undefined,
                notes: notes.trim() || undefined,
            };

            const newClient = await clientService.create(companyId, payload);
            onClientCreated?.(newClient);
            toast({
                title: 'Client créé',
                description: 'Le client a été ajouté avec succès',
            });
            handleOpenChange(false);
        } catch (error: any) {
            const permissionErrorMessage = "Vous n'avez pas les droits pour créer un client. Contactez un administrateur.";
            const description = error instanceof ApiRequestError && error.status === 403
                ? permissionErrorMessage
                : error.message || 'Impossible de créer le client';
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl gap-0 p-0">
                <DialogHeader className="border-b px-4 py-4">
                    <DialogTitle>Nouveau client</DialogTitle>
                    <DialogDescription>
                        Créez un client sans quitter la page en cours.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="px-4 py-3">
                    <form id="client-create-dialog-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Type de client</Label>
                        <Select value={type} onValueChange={(value) => setType(value as ClientType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="professional">Professionnel</SelectItem>
                                <SelectItem value="individual">Particulier</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {type === 'professional' ? (
                        <>
                            <EnterpriseLookupField
                                mode="authenticated"
                                onSelect={handleSirenSelect}
                                onClear={handleSirenClear}
                                selectedName={selectedCompanyName}
                                compact
                            />
                            <div className="space-y-2">
                                <Label htmlFor="client-company-name">Raison sociale *</Label>
                                <Input
                                    id="client-company-name"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Ex: Acme SAS"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="client-siren">SIREN</Label>
                                <Input
                                    id="client-siren"
                                    value={siren}
                                    onChange={(e) => setSiren(e.target.value)}
                                    placeholder="123456789"
                                    maxLength={9}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="client-first-name">Prénom</Label>
                                <Input
                                    id="client-first-name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="client-last-name">Nom *</Label>
                                <Input
                                    id="client-last-name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="client-email">Email *</Label>
                            <Input
                                id="client-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contact@client.fr"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client-phone">Téléphone</Label>
                            <Input
                                id="client-phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="client-address">Adresse</Label>
                        <Input
                            id="client-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="client-postal-code">Code postal</Label>
                            <Input
                                id="client-postal-code"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client-city">Ville</Label>
                            <Input
                                id="client-city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="client-notes">Notes</Label>
                        <Textarea
                            id="client-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                    </form>
                </DialogBody>
                <DialogFooter className="border-t px-4 py-4">
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                        Annuler
                    </Button>
                    <Button type="submit" form="client-create-dialog-form" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer le client
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
