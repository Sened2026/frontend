import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Page de réinitialisation du mot de passe
 */
export function ForgotPassword() {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    /**
     * Gère la soumission du formulaire
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast({
                title: 'Email requis',
                description: 'Veuillez entrer votre adresse email.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const redirectTo = new URL(
                '/auth/reset-password',
                window.location.origin
            ).toString();

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });

            if (error) throw error;

            setEmailSent(true);
            toast({
                title: 'Email envoyé !',
                description: 'Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.',
            });
        } catch (error: any) {
            console.error('Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Une erreur est survenue.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <Card className="relative z-10 w-full max-w-md border shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                        <Mail className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        {emailSent ? 'Email envoyé !' : 'Mot de passe oublié ?'}
                    </CardTitle>
                    <CardDescription>
                        {emailSent
                            ? 'Nous vous avons envoyé un email avec les instructions pour réinitialiser votre mot de passe.'
                            : 'Entrez votre email pour recevoir un lien de réinitialisation.'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {!emailSent ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="votre@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                        Envoi en cours...
                                    </>
                                ) : (
                                    'Envoyer le lien'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Si vous ne recevez pas l'email dans quelques minutes, vérifiez vos
                                spams ou{' '}
                                <button
                                    onClick={() => {
                                        setEmailSent(false);
                                        setEmail('');
                                    }}
                                    className="text-primary hover:underline"
                                >
                                    réessayez
                                </button>
                                .
                            </p>
                        </div>
                    )}

                    <div className="mt-6">
                        <Link to="/auth/login">
                            <Button variant="ghost" className="w-full" size="lg">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Retour à la connexion
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
                © 2026 SENED. Tous droits réservés.
            </div>
        </div>
    );
}
