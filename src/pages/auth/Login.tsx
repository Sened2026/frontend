import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';

/**
 * Page de connexion avec email et mot de passe
 */
export function Login() {
    const { user, loading, signInWithEmail } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirige vers le dashboard si déjà connecté
    useEffect(() => {
        if (user && !loading) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, loading, navigate]);

    /**
     * Gère la soumission du formulaire de connexion
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation basique
        if (!email || !password) {
            toast({
                title: 'Champs manquants',
                description: 'Veuillez remplir tous les champs.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await signInWithEmail(email, password);
            toast({
                title: 'Connexion réussie',
                description: 'Bienvenue !',
            });
            navigate('/dashboard');
        } catch (error: any) {
            console.error('Erreur de connexion:', error);
            const msg = error?.message?.toLowerCase() || '';
            let description = 'Une erreur est survenue. Veuillez réessayer.';

            if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
                description = 'Aucun compte trouvé avec cet email ou mot de passe incorrect.';
            } else if (msg.includes('email not confirmed')) {
                description = 'Votre adresse email n\'a pas encore été confirmée. Vérifiez votre boîte de réception.';
            } else if (msg.includes('too many requests') || error?.status === 429) {
                description = 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
            } else if (msg.includes('user banned') || msg.includes('user_banned')) {
                description = 'Ce compte a été désactivé. Contactez le support.';
            }

            toast({
                title: 'Erreur de connexion',
                description,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Affiche un loader pendant la vérification
    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            {/* Carte de connexion */}
            <Card className="relative z-10 w-full max-w-md border shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="mb-2 flex justify-start">
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="gap-1 px-2">
                                <ArrowLeft className="h-4 w-4" />
                                Retour à l'accueil
                            </Button>
                        </Link>
                    </div>
                    <Link to="/" className="mx-auto mb-4 flex items-center gap-2">
                        <img
                            src="/brand/secondaire/SVG/SECONDAIRE_bleu.svg"
                            alt="Sened"
                            className="h-8 w-auto"
                        />
                    </Link>
                    <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
                    <CardDescription>
                        Connectez-vous à votre espace de gestion
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Champ Email */}
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

                        {/* Champ Mot de passe */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Mot de passe</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Lien mot de passe oublié */}
                        <div className="flex justify-end">
                            <Link
                                to="/auth/forgot-password"
                                className="text-sm text-primary hover:underline"
                            >
                                Mot de passe oublié ?
                            </Link>
                        </div>

                        {/* Bouton de connexion */}
                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                    Connexion...
                                </>
                            ) : (
                                'Se connecter'
                            )}
                        </Button>
                    </form>

                    {/* Séparateur */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Nouveau ici ?
                            </span>
                        </div>
                    </div>

                    {/* Lien vers inscription */}
                    <div className="text-center">
                        <Link to="/auth/register">
                            <Button variant="outline" className="w-full" size="lg">
                                Créer un compte
                            </Button>
                        </Link>
                    </div>

                    {/* Texte d'information */}
                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        Consultez nos{' '}
                        <Link to="/legal/cgv" className="underline hover:text-foreground">
                            CGV
                        </Link>{' '}
                        et notre{' '}
                        <Link to="/legal/confidentialite" className="underline hover:text-foreground">
                            politique de confidentialité
                        </Link>
                    </p>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
                © 2026 SENED. Tous droits réservés.
            </div>
        </div>
    );
}
