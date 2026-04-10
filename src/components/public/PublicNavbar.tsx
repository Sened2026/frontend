import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function PublicNavbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        setMobileMenuOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link to="/" className="flex items-center gap-2">
                    <img
                        src="/brand/secondaire/SVG/SECONDAIRE_bleu.svg"
                        alt="Sened"
                        className="h-7 w-auto sm:h-8"
                    />
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                    <button
                        onClick={() => scrollToSection('features')}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Produit
                    </button>
                    <button
                        onClick={() => scrollToSection('pricing')}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Tarifs
                    </button>
                </nav>

                <div className="hidden md:flex items-center gap-3">
                    <Link to="/auth/login">
                        <Button variant="ghost">Se connecter</Button>
                    </Link>
                    <Link to="/auth/register">
                        <Button className="rounded-full">Démarrer maintenant</Button>
                    </Link>
                </div>

                <button
                    className="md:hidden"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <Menu className="h-6 w-6" />
                    )}
                </button>
            </div>

            {mobileMenuOpen && (
                <div className="md:hidden border-b bg-background">
                    <nav className="container mx-auto flex flex-col gap-4 px-4 py-4">
                        <button
                            onClick={() => scrollToSection('features')}
                            className="text-left text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            Produit
                        </button>
                        <button
                            onClick={() => scrollToSection('pricing')}
                            className="text-left text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            Tarifs
                        </button>
                        <div className="flex flex-col gap-2 pt-2 border-t">
                            <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                                <Button variant="outline" className="w-full">
                                    Se connecter
                                </Button>
                            </Link>
                            <Link to="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full rounded-full">Démarrer maintenant</Button>
                            </Link>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
