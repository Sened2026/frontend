import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SUPPORT_EMAIL = 'contact@sened.fr';

export function SupportPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Centre d'aide</h1>
                <p className="text-muted-foreground">Contactez l'équipe SENED par email.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Besoin d'aide ?</CardTitle>
                    <CardDescription>
                        Décrivez votre demande et ajoutez les informations utiles pour faciliter le traitement.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <a href={`mailto:${SUPPORT_EMAIL}`}>
                            <Mail className="mr-2 h-4 w-4" />
                            Contacter le support
                        </a>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
