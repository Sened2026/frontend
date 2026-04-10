import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
    supabase,
    signInWithEmail as supabaseSignInEmail,
    signUpWithEmail as supabaseSignUpEmail,
    signOut as supabaseSignOut,
    SignUpMetadata,
} from '@/lib/supabase';
import { authService } from '@/services/api';
import type { AuthContextType } from '@/types';

// Création du context avec valeur par défaut undefined
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Provider d'authentification
 * Gère l'état global de l'utilisateur et la session Supabase
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [canInviteSuperadmin, setCanInviteSuperadmin] = useState(false);
    const [isRootSuperadmin, setIsRootSuperadmin] = useState(false);

    const updateUserState = useCallback(
        (nextSession: Session | null, event?: string) => {
            const nextUser = nextSession?.user ?? null;

            setUser((currentUser) => {
                if (event === 'TOKEN_REFRESHED' && currentUser?.id === nextUser?.id) {
                    return currentUser;
                }

                if (currentUser?.id === nextUser?.id && currentUser === nextUser) {
                    return currentUser;
                }

                return nextUser;
            });
        },
        []
    );

    const loadAuthCapabilities = useCallback(async (nextSession: Session | null) => {
        if (!nextSession) {
            setCanInviteSuperadmin(false);
            setIsRootSuperadmin(false);
            return;
        }

        try {
            const me = await authService.getMe();
            setCanInviteSuperadmin(Boolean(me.can_invite_superadmin));
            setIsRootSuperadmin(Boolean(me.is_root_superadmin));
        } catch (error) {
            console.error(
                'Erreur lors du chargement des permissions utilisateur:',
                error,
            );
            setCanInviteSuperadmin(false);
            setIsRootSuperadmin(false);
        }
    }, []);

    // Écoute les changements d'état d'authentification
    useEffect(() => {
        // Récupère la session initiale
        const getInitialSession = async () => {
            try {
                const {
                    data: { session: initialSession },
                } = await supabase.auth.getSession();

                setSession(initialSession);
                updateUserState(initialSession);
                await loadAuthCapabilities(initialSession);
            } catch (error) {
                console.error('Erreur lors de la récupération de la session:', error);
            } finally {
                setLoading(false);
            }
        };

        getInitialSession();

        // Écoute les changements de session (login, logout, refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession);
            updateUserState(newSession, event);
            void loadAuthCapabilities(newSession);
            setLoading(false);

            if (
                event === 'PASSWORD_RECOVERY'
                && window.location.pathname !== '/auth/reset-password'
            ) {
                window.location.replace('/auth/reset-password');
            }
        });

        // Nettoyage de l'abonnement
        return () => {
            subscription.unsubscribe();
        };
    }, [loadAuthCapabilities, updateUserState]);

    // Connexion avec email et mot de passe
    const signInWithEmail = useCallback(async (email: string, password: string) => {
        try {
            await supabaseSignInEmail(email, password);
        } catch (error) {
            console.error('Erreur lors de la connexion:', error);
            throw error;
        }
    }, []);

    const signUpWithEmail = useCallback(async (email: string, password: string, metadata: string | SignUpMetadata) => {
        try {
            await supabaseSignUpEmail(email, password, metadata);
        } catch (error) {
            console.error('Erreur lors de l\'inscription:', error);
            throw error;
        }
    }, []);

    // Déconnexion
    const signOut = useCallback(async () => {
        try {
            await supabaseSignOut();
            setUser(null);
            setSession(null);
            setCanInviteSuperadmin(false);
            setIsRootSuperadmin(false);
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            throw error;
        }
    }, []);

    const value: AuthContextType = {
        user,
        session,
        loading,
        canInviteSuperadmin,
        isRootSuperadmin,
        signInWithEmail,
        signUpWithEmail,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook pour accéder au context d'authentification
 * @throws Error si utilisé en dehors du AuthProvider
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth doit être utilisé dans un AuthProvider');
    }

    return context;
}
