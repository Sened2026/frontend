import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm';
import { companyService, subscriptionService } from '@/services/api';
import type { CreateCompanyData } from '@/types';
import { useCompany } from '@/hooks/useCompany';
import { useSubscription } from '@/hooks/useSubscription';

export function CompanyCreate() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { setCurrentCompany, refreshCompanies } = useCompany();
    const { refresh: refreshSubscription } = useSubscription();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (data: CreateCompanyData) => {
        if (!data.name?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Le nom de l’entreprise est obligatoire.',
            });
            return;
        }

        try {
            setIsSubmitting(true);

            if (data.owner_role === 'merchant_admin') {
                const pendingSession =
                    await subscriptionService.createPendingCompanySubscription({
                        company_data: {
                            ...data,
                            owner_role: 'merchant_admin',
                        },
                    });

                toast({
                    title: 'Paiement requis',
                    description: 'Finalisez le paiement pour créer cette entreprise.',
                });
                navigate(
                    `/subscribe?pending_company_session=${pendingSession.session_id}`,
                );
                return;
            }

            const company = await companyService.create(data);
            setCurrentCompany(company);
            await Promise.all([refreshCompanies(), refreshSubscription()]);

            toast({
                title: 'Entreprise créée',
                description: `${company.name} est maintenant votre entreprise active.`,
            });

            if (company.company_owner_role === 'merchant_admin' && company.role === 'merchant_admin') {
                navigate('/subscribe');
                return;
            }

            navigate('/dashboard');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de créer l’entreprise.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Créer une entreprise</h1>
                    <p className="text-muted-foreground">
                        Créez votre propre structure et définissez son rôle propriétaire dès le départ.
                    </p>
                </div>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Nouvelle société</CardTitle>
                            <CardDescription>
                                Seul le nom est obligatoire. Les autres champs peuvent être complétés plus tard.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CompanyCreateForm
                        isSubmitting={isSubmitting}
                        onCancel={() => navigate('/dashboard')}
                        onSubmit={handleSubmit}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
