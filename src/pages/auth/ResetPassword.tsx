import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Page de définition d'un nouveau mot de passe après un lien Supabase.
 */
export function ResetPassword() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [hasRecoverySession, setHasRecoverySession] = useState(false);

    const recoveryTypeInUrl = useMemo(() => {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = new URLSearchParams(window.location.search);

        return (
            hashParams.get('type') === 'recovery'
            || queryParams.get('type') === 'recovery'
        );
    }, []);

    useEffect(() => {
        let mounted = true;
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setHasRecoverySession(Boolean(session) || recoveryTypeInUrl);
                setIsCheckingSession(false);
            }
        });

        const checkRecoverySession = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!mounted) {
                    return;
                }

                setHasRecoverySession(Boolean(session) || recoveryTypeInUrl);
            } catch (error) {
                console.error(
                    'Erreur lors de la vérification de la session de récupération:',
                    error,
                );

                if (mounted) {
                    setHasRecoverySession(recoveryTypeInUrl);
                }
            } finally {
                if (mounted) {
                    setIsCheckingSession(false);
                }
            }
        };

        void checkRecoverySession();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [recoveryTypeInUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hasRecoverySession) {
            toast({
                title: 'Lien invalide',
                description: 'Demandez un nouveau lien de réinitialisation.',
                variant: 'destructive',
            });
            return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            toast({
                title: 'Mot de passe trop court',
                description: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
                variant: 'destructive',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: 'Confirmation invalide',
                description: 'Les mots de passe ne correspondent pas.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                throw error;
            }

            await supabase.auth.signOut();

            toast({
                title: 'Mot de passe mis à jour',
                description: 'Vous pouvez maintenant vous reconnecter.',
            });

            navigate('/auth/login', { replace: true });
        } catch (error: any) {
            console.error('Erreur lors de la mise à jour du mot de passe:', error);
            toast({
                title: 'Erreur',
                description:
                    error?.message
                    || 'Impossible de mettre à jour votre mot de passe.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isCheckingSession) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <Card className="relative z-10 w-full max-w-md border shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="mb-2 flex justify-start">
                        <Link to="/auth/login">
                            <Button variant="ghost" size="sm" className="gap-1 px-2">
                                <ArrowLeft className="h-4 w-4" />
                                Retour à la connexion
                            </Button>
                        </Link>
                    </div>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                        <Lock className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        Définir un nouveau mot de passe
                    </CardTitle>
                    <CardDescription>
                        {hasRecoverySession
                            ? 'Choisissez un nouveau mot de passe pour votre compte.'
                            : 'Ce lien est invalide ou a expiré.'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {hasRecoverySession ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Nouveau mot de passe</Label>
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
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
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

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">
                                    Confirmer le mot de passe
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10 pr-10"
                                        required
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
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
                                        Mise à jour...
                                    </>
                                ) : (
                                    'Enregistrer le nouveau mot de passe'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-center text-sm text-muted-foreground">
                                Demandez un nouveau lien de réinitialisation pour continuer.
                            </p>
                            <Link to="/auth/forgot-password">
                                <Button className="w-full" size="lg">
                                    Demander un nouveau lien
                                </Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
