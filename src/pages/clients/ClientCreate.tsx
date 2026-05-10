import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, User, Landmark, Lock, Search, Loader2, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { EnterpriseLookupField } from '@/components/shared/EnterpriseLookupField';
import { BusinessIdentityFields } from '@/components/shared/BusinessIdentityFields';
import { getClientEmailValidationMessage, normalizeClientEmail } from '@/lib/client-validation';
import { clientService } from '@/services/api';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { chorusProService } from '@/services/api';
import type { ClientType, ClientSector, ChorusEligibilityStatus, CreateClientData, SirenSearchResult } from '@/types';
import type { PrefillableField } from '@/hooks/useEnterpriseLookup';

export function ClientCreate() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { operationalCompany: currentCompany, loading: companyLoading } = useOperationalCompany();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [chorusVerifying, setChorusVerifying] = useState(false);
  const [chorusSettings, setChorusSettings] = useState<{ enabled: boolean } | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<Set<PrefillableField>>(new Set());
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>();

  // Données Chorus du client (lecture seule, gérées par verify-chorus)
  const [chorusData, setChorusData] = useState<{
    eligibility_status: ChorusEligibilityStatus;
    structure_label: string | null;
    service_code_required: boolean | null;
    engagement_required: boolean | null;
    last_checked_at: string | null;
  }>({
    eligibility_status: 'unchecked',
    structure_label: null,
    service_code_required: null,
    engagement_required: null,
    last_checked_at: null,
  });

  const [chorusSearchResults, setChorusSearchResults] = useState<any[]>([]);

  const [formData, setFormData] = useState<CreateClientData & { client_sector?: ClientSector }>({
    type: 'professional',
    client_sector: 'private',
    first_name: '',
    last_name: '',
    company_name: '',
    siret: '',
    siren: '',
    vat_number: '',
    email: '',
    phone: '',
    signature_contact_first_name: '',
    signature_contact_last_name: '',
    signature_contact_email: '',
    signature_contact_phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'FR',
    notes: '',
    chorus_pro_code_destinataire: '',
    chorus_pro_cadre_facturation: 'A1_FACTURE_FOURNISSEUR',
    chorus_pro_code_service_executant: '',
    chorus_pro_numero_engagement: '',
  });

  // Charger les données du client en mode édition
  useEffect(() => {
    if (isEditMode && id && currentCompany) {
      loadClient(id);
    }
  }, [id, isEditMode, currentCompany]);

  // Charger les settings Chorus Pro de l'entreprise
  useEffect(() => {
    if (currentCompany) {
      chorusProService.getSettings(currentCompany.id)
        .then((settings) => setChorusSettings(settings ? { enabled: settings.enabled } : null))
        .catch(() => setChorusSettings(null));
    }
  }, [currentCompany]);

  const loadClient = async (clientId: string) => {
    if (!currentCompany) return;
    
    setLoadingClient(true);
    try {
      const client = await clientService.getById(currentCompany.id, clientId);
      setFormData({
        type: client.type,
        client_sector: client.client_sector || (client.type === 'professional' ? 'private' : undefined),
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        company_name: client.company_name || '',
        siret: client.siret || '',
        siren: client.siren || '',
        vat_number: client.vat_number || '',
        email: client.email || '',
        phone: client.phone || '',
        signature_contact_first_name: client.signature_contact_first_name || '',
        signature_contact_last_name: client.signature_contact_last_name || '',
        signature_contact_email: client.signature_contact_email || '',
        signature_contact_phone: client.signature_contact_phone || '',
        address: client.address || '',
        city: client.city || '',
        postal_code: client.postal_code || '',
        country: client.country || 'France',
        notes: client.notes || '',
        chorus_pro_code_destinataire: client.chorus_pro_code_destinataire || '',
        chorus_pro_cadre_facturation: client.chorus_pro_cadre_facturation || 'A1_FACTURE_FOURNISSEUR',
        chorus_pro_code_service_executant: client.chorus_pro_code_service_executant || '',
        chorus_pro_numero_engagement: client.chorus_pro_numero_engagement || '',
      });
      setChorusData({
        eligibility_status: client.chorus_pro_eligibility_status || 'unchecked',
        structure_label: client.chorus_pro_structure_label,
        service_code_required: client.chorus_pro_service_code_required,
        engagement_required: client.chorus_pro_engagement_required,
        last_checked_at: client.chorus_pro_last_checked_at,
      });
      
      // Si le client a un SIREN/SIRET, marquer les champs comme préremplis (indicateur visuel)
      if (client.type === 'professional' && (client.siren || client.siret)) {
        const prefilled = new Set<PrefillableField>();
        if (client.company_name) prefilled.add('company_name');
        if (client.siren) prefilled.add('siren');
        if (client.siret) prefilled.add('siret');
        if (client.address) prefilled.add('address');
        if (client.city) prefilled.add('city');
        if (client.postal_code) prefilled.add('postal_code');
        setPrefilledFields(prefilled);
        setSelectedCompanyName(client.company_name || undefined);
      }
    } catch (error) {
      console.error('Error loading client:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données du client',
        variant: 'destructive',
      });
      navigate('/clients');
    } finally {
      setLoadingClient(false);
    }
  };

  const handleChange = (field: keyof CreateClientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSectorChange = (sector: 'individual' | 'private' | 'public') => {
    if (sector === 'individual') {
      setFormData((prev) => ({
        ...prev,
        type: 'individual' as ClientType,
        client_sector: undefined,
        company_name: '', siret: '', siren: '', vat_number: '',
      }));
      setPrefilledFields(new Set());
      setSelectedCompanyName(undefined);
      setChorusData({ eligibility_status: 'unchecked', structure_label: null, service_code_required: null, engagement_required: null, last_checked_at: null });
    } else {
      setFormData((prev) => ({
        ...prev,
        type: 'professional' as ClientType,
        client_sector: sector as ClientSector,
        first_name: '', last_name: '',
      }));
    }
  };

  const handleVerifyChorus = async () => {
    if (!currentCompany || !id) return;

    setChorusVerifying(true);
    try {
      const updatedClient = await clientService.verifyChorus(currentCompany.id, id);
      setChorusData({
        eligibility_status: updatedClient.chorus_pro_eligibility_status,
        structure_label: updatedClient.chorus_pro_structure_label,
        service_code_required: updatedClient.chorus_pro_service_code_required,
        engagement_required: updatedClient.chorus_pro_engagement_required,
        last_checked_at: updatedClient.chorus_pro_last_checked_at,
      });
      // Mettre à jour le code destinataire auto-rempli
      if (updatedClient.chorus_pro_code_destinataire) {
        setFormData((prev) => ({
          ...prev,
          chorus_pro_code_destinataire: updatedClient.chorus_pro_code_destinataire || '',
        }));
      }
      toast({
        title: updatedClient.chorus_pro_eligibility_status === 'eligible'
          ? 'Client compatible Chorus Pro'
          : 'Client non reconnu',
        description: updatedClient.chorus_pro_eligibility_status === 'eligible'
          ? `Structure trouvée : ${updatedClient.chorus_pro_structure_label}`
          : 'Ce client n\'est pas un destinataire Chorus Pro actif',
        variant: updatedClient.chorus_pro_eligibility_status === 'eligible' ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur de vérification',
        description: error.message || 'Impossible de vérifier l\'éligibilité Chorus Pro',
        variant: 'destructive',
      });
    } finally {
      setChorusVerifying(false);
    }
  };

  const handleSirenSelect = (result: SirenSearchResult) => {
    setFormData((prev) => ({
      ...prev,
      company_name: result.company_name || prev.company_name,
      siret: result.siret || prev.siret,
      siren: result.siren || prev.siren,
      vat_number: result.vat_number || prev.vat_number,
      address: result.address || prev.address,
      city: result.city || prev.city,
      postal_code: result.postal_code || prev.postal_code,
      country: result.country_code || prev.country || 'FR',
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
    setFormData((prev) => ({
      ...prev,
      company_name: '',
      siret: '',
      siren: '',
      vat_number: '',
      address: '',
      city: '',
      postal_code: '',
    }));
  };

  const selectChorusResult = (structure: any) => {
    const identifiant = structure.identifiantStructure || '';
    const isSiret = structure.typeIdentifiantStructure === 'SIRET';
    const designation = structure.designationStructure || '';

    const newPrefilled = new Set<PrefillableField>();
    if (designation) newPrefilled.add('company_name');
    if (identifiant) newPrefilled.add(isSiret ? 'siret' : 'siren');

    setFormData((prev) => ({
      ...prev,
      company_name: designation,
      siret: isSiret ? identifiant : prev.siret,
      siren: !isSiret ? identifiant : prev.siren,
    }));
    setPrefilledFields(newPrefilled);
    setChorusSearchResults([]);
    toast({
      title: 'Structure Chorus Pro sélectionnée',
      description: `${designation} — ${identifiant}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientEmail = normalizeClientEmail(formData.email);

    if (!currentCompany) {
      toast({
        title: 'Erreur',
        description: 'Aucune entreprise sélectionnée',
        variant: 'destructive',
      });
      return;
    }

    // Validation basique
    if (formData.type === 'professional' && !formData.company_name) {
      toast({
        title: 'Erreur de validation',
        description: 'Le nom de l\'entreprise est requis pour un client professionnel',
        variant: 'destructive',
      });
      return;
    }

    if (formData.type === 'individual' && (!formData.first_name || !formData.last_name)) {
      toast({
        title: 'Erreur de validation',
        description: 'Le prénom et le nom sont requis pour un client particulier',
        variant: 'destructive',
      });
      return;
    }

    const emailValidationMessage = getClientEmailValidationMessage(clientEmail);
    if (emailValidationMessage) {
      toast({
        title: 'Erreur de validation',
        description: emailValidationMessage,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Nettoyer les données vides
      const cleanedData: CreateClientData = {
        type: formData.type,
        client_sector: formData.type === 'professional' ? formData.client_sector : undefined,
        country: formData.country || 'FR',
      };

      // Ajouter seulement les champs non vides
      if (formData.first_name) cleanedData.first_name = formData.first_name;
      if (formData.last_name) cleanedData.last_name = formData.last_name;
      if (formData.company_name) cleanedData.company_name = formData.company_name;
      if (formData.siret) cleanedData.siret = formData.siret;
      if (formData.siren) cleanedData.siren = formData.siren;
      if (formData.vat_number) cleanedData.vat_number = formData.vat_number;
      cleanedData.email = clientEmail;
      if (formData.phone) cleanedData.phone = formData.phone;
      if (formData.signature_contact_first_name) cleanedData.signature_contact_first_name = formData.signature_contact_first_name;
      if (formData.signature_contact_last_name) cleanedData.signature_contact_last_name = formData.signature_contact_last_name;
      if (formData.signature_contact_email) cleanedData.signature_contact_email = formData.signature_contact_email;
      if (formData.signature_contact_phone) cleanedData.signature_contact_phone = formData.signature_contact_phone;
      if (formData.address) cleanedData.address = formData.address;
      if (formData.city) cleanedData.city = formData.city;
      if (formData.postal_code) cleanedData.postal_code = formData.postal_code;
      if (formData.notes) cleanedData.notes = formData.notes;

      // Champs Chorus Pro (uniquement pour les professionnels publics)
      if (formData.type === 'professional' && formData.client_sector === 'public') {
        if (formData.chorus_pro_code_destinataire) cleanedData.chorus_pro_code_destinataire = formData.chorus_pro_code_destinataire;
        if (formData.chorus_pro_cadre_facturation) cleanedData.chorus_pro_cadre_facturation = formData.chorus_pro_cadre_facturation;
        if (formData.chorus_pro_code_service_executant) cleanedData.chorus_pro_code_service_executant = formData.chorus_pro_code_service_executant;
        if (formData.chorus_pro_numero_engagement) cleanedData.chorus_pro_numero_engagement = formData.chorus_pro_numero_engagement;
      }

      if (isEditMode && id) {
        await clientService.update(currentCompany.id, id, cleanedData);
        toast({
          title: 'Client modifié',
          description: 'Les informations du client ont été mises à jour',
        });
        navigate(`/clients/${id}`);
      } else {
        const newClient = await clientService.create(currentCompany.id, cleanedData);
        toast({
          title: 'Client créé',
          description: 'Le nouveau client a été ajouté avec succès',
        });
        navigate(`/clients/${newClient.id}`);
      }
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Impossible de sauvegarder le client',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (companyLoading || loadingClient) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(isEditMode ? `/clients/${id}` : '/clients')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditMode ? 'Modifier le client' : 'Nouveau client'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? 'Modifiez les informations du client'
              : 'Ajoutez un nouveau client à votre portefeuille'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de client */}
        <Card>
          <CardHeader>
            <CardTitle>Type de client</CardTitle>
            <CardDescription>
              Sélectionnez le type de client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleSectorChange('private')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  formData.type === 'professional' && formData.client_sector === 'private'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Building2
                  className={`h-8 w-8 ${
                    formData.type === 'professional' && formData.client_sector === 'private' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="font-medium">Entreprise</span>
                <span className="text-xs text-muted-foreground">Société privée</span>
              </button>
              <button
                type="button"
                onClick={() => handleSectorChange('individual')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  formData.type === 'individual'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <User
                  className={`h-8 w-8 ${
                    formData.type === 'individual' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="font-medium">Particulier</span>
                <span className="text-xs text-muted-foreground">Personne physique</span>
              </button>
              <button
                type="button"
                onClick={() => handleSectorChange('public')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  formData.client_sector === 'public'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Landmark
                  className={`h-8 w-8 ${
                    formData.client_sector === 'public' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="font-medium">Organisme public</span>
                <span className="text-xs text-muted-foreground">État, collectivités</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Recherche SIREN (uniquement pour les professionnels) */}
        {formData.type === 'professional' && (
          <Card>
            <CardHeader>
              <CardTitle>Recherche SIREN/SIRET</CardTitle>
              <CardDescription>
                Recherchez une entreprise par son nom, SIREN ou SIRET pour pré-remplir les
                informations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <EnterpriseLookupField
                mode="authenticated"
                onSelect={handleSirenSelect}
                onClear={handleSirenClear}
                selectedName={selectedCompanyName}
              />

              {/* Résultats Chorus Pro (flux séparé) */}
              {chorusSearchResults.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Structures Chorus Pro</p>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {chorusSearchResults.map((structure: any) => (
                      <button
                        key={structure.idStructureCPP}
                        type="button"
                        onClick={() => selectChorusResult(structure)}
                        className="w-full p-3 text-left hover:bg-muted transition-colors"
                      >
                        <div className="font-medium">{structure.designationStructure}</div>
                        <div className="text-sm text-muted-foreground">
                          {structure.typeIdentifiantStructure}: {structure.identifiantStructure}
                          {' • '}Statut: {structure.statut}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Informations du client */}
        <Card>
          <CardHeader>
            <CardTitle>
              {formData.type === 'professional'
                ? 'Informations de l\'entreprise'
                : 'Informations personnelles'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.type === 'professional' ? (
              <BusinessIdentityFields
                variant="client-pro"
                values={formData}
                prefilledFields={prefilledFields}
                onChange={(field, value) => handleChange(field as keyof CreateClientData, value)}
                disabled={loading}
              />
            ) : (
              <>
                {/* Champs particuliers */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      placeholder="Prénom"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      placeholder="Nom"
                      required
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@exemple.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="01 23 45 67 89"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adresse (uniquement pour les particuliers — les pros ont l'adresse dans BusinessIdentityFields) */}
        {formData.type === 'individual' && (
          <Card>
            <CardHeader>
              <CardTitle>Adresse</CardTitle>
            </CardHeader>
            <CardContent>
              <BusinessIdentityFields
                variant="client-individual"
                values={formData}
                prefilledFields={prefilledFields}
                onChange={(field, value) => handleChange(field as keyof CreateClientData, value)}
                disabled={loading}
              />
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Informations complémentaires sur ce client (optionnel)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notes internes sur ce client..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Chorus Pro (uniquement pour les clients publics) */}
        {formData.client_sector === 'public' && (
          <Card>
            <CardHeader>
              <CardTitle>Chorus Pro</CardTitle>
              <CardDescription>
                Vérifiez l'éligibilité de ce client dans Chorus Pro pour l'envoi de factures dématérialisées.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bouton vérification + badge */}
              <div className="flex items-center gap-3 flex-wrap">
                {isEditMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyChorus}
                    disabled={chorusVerifying || !chorusSettings?.enabled || !(formData.siret || formData.siren)}
                  >
                    {chorusVerifying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Vérifier avec Chorus
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Enregistrez le client puis vérifiez l'éligibilité Chorus Pro
                  </p>
                )}

                {!chorusSettings?.enabled && (
                  <p className="text-sm text-amber-600">
                    Configurez Chorus Pro dans les paramètres entreprise
                  </p>
                )}

                {/* Badge éligibilité */}
                {chorusData.eligibility_status === 'eligible' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Compatible Chorus Pro
                  </span>
                )}
                {chorusData.eligibility_status === 'ineligible' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <XCircle className="h-4 w-4" />
                    Non reconnu comme destinataire Chorus
                  </span>
                )}
                {chorusData.eligibility_status === 'error' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    Erreur de vérification
                  </span>
                )}
                {chorusData.eligibility_status === 'unchecked' && isEditMode && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                    <HelpCircle className="h-4 w-4" />
                    À vérifier
                  </span>
                )}
              </div>

              {/* Détails structure si eligible */}
              {chorusData.eligibility_status === 'eligible' && chorusData.structure_label && (
                <div className="p-3 bg-green-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-green-800">Structure : {chorusData.structure_label}</p>
                  {chorusData.service_code_required && (
                    <p className="text-green-700">Code service requis</p>
                  )}
                  {chorusData.engagement_required && (
                    <p className="text-green-700">Numéro d'engagement requis</p>
                  )}
                  {chorusData.last_checked_at && (
                    <p className="text-green-600 text-xs">
                      Dernière vérification : {new Date(chorusData.last_checked_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              )}

              {/* Champs par défaut */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="chorus_pro_code_destinataire" className="flex items-center gap-2">
                    Code destinataire
                    {chorusData.eligibility_status === 'eligible' && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <Input
                    id="chorus_pro_code_destinataire"
                    value={formData.chorus_pro_code_destinataire}
                    onChange={(e) => handleChange('chorus_pro_code_destinataire', e.target.value)}
                    placeholder="Rempli automatiquement par la vérification"
                    maxLength={50}
                    disabled={chorusData.eligibility_status === 'eligible'}
                    className={chorusData.eligibility_status === 'eligible' ? 'bg-muted' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chorus_pro_cadre_facturation">Cadre de facturation</Label>
                  <Select
                    value={formData.chorus_pro_cadre_facturation || 'A1_FACTURE_FOURNISSEUR'}
                    onValueChange={(value) => handleChange('chorus_pro_cadre_facturation', value)}
                  >
                    <SelectTrigger id="chorus_pro_cadre_facturation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A1_FACTURE_FOURNISSEUR">A1 - Facture fournisseur</SelectItem>
                      <SelectItem value="A2_FACTURE_FOURNISSEUR_DEJA_PAYEE">A2 - Facture fournisseur déjà payée</SelectItem>
                      <SelectItem value="A9_FACTURE_SOUSTRAITANT">A9 - Facture sous-traitant</SelectItem>
                      <SelectItem value="A12_FACTURE_COTRAITANT">A12 - Facture co-traitant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(chorusData.service_code_required || formData.chorus_pro_code_service_executant) && (
                  <div className="space-y-2">
                    <Label htmlFor="chorus_pro_code_service_executant">
                      Code service exécutant {chorusData.service_code_required && '*'}
                    </Label>
                    <Input
                      id="chorus_pro_code_service_executant"
                      value={formData.chorus_pro_code_service_executant}
                      onChange={(e) => handleChange('chorus_pro_code_service_executant', e.target.value)}
                      placeholder="Code service"
                      maxLength={50}
                    />
                  </div>
                )}
                {(chorusData.engagement_required || formData.chorus_pro_numero_engagement) && (
                  <div className="space-y-2">
                    <Label htmlFor="chorus_pro_numero_engagement">
                      Numéro d'engagement {chorusData.engagement_required && '*'}
                    </Label>
                    <Input
                      id="chorus_pro_numero_engagement"
                      value={formData.chorus_pro_numero_engagement}
                      onChange={(e) => handleChange('chorus_pro_numero_engagement', e.target.value)}
                      placeholder="Numéro d'engagement"
                      maxLength={50}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEditMode ? `/clients/${id}` : '/clients')}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Enregistrer les modifications' : 'Créer le client'}
          </Button>
        </div>
      </form>
    </div>
  );
}
