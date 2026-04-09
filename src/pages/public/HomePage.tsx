import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    FileText,
    Receipt,
    BarChart3,
    Check,
    ArrowRight,
    Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// import {
//     Accordion,
//     AccordionContent,
//     AccordionItem,
//     AccordionTrigger,
// } from '@/components/ui/accordion';
import { PublicNavbar } from "@/components/public/PublicNavbar";
// import { PublicFooter } from '@/components/public/PublicFooter';

const features = [
    {
        icon: FileText,
        title: "Facturation simple",
        description:
            "Créez et envoyez vos factures en quelques clics avec nos templates personnalisables",
    },
    {
        icon: Receipt,
        title: "Suivi automatique",
        description:
            "Relances automatiques et suivi en temps réel de vos paiements",
    },
    {
        icon: BarChart3,
        title: "Reporting complet",
        description:
            "Tableaux de bord détaillés pour suivre votre chiffre d'affaires",
    },
];

import { subscriptionService, type SubscriptionPlan } from "@/services/api";

const HIGHLIGHT_SLUG = "business";

function buildPlanFeatures(plan: SubscriptionPlan): string[] {
    const features: string[] = [];
    features.push(
        plan.max_quotes_per_month
            ? `${plan.max_quotes_per_month} devis/mois`
            : "Devis illimités",
    );
    features.push(
        plan.max_invoices_per_month
            ? `${plan.max_invoices_per_month} factures/mois`
            : "Factures illimitées",
    );
    if (plan.max_storage_mb >= 10000) {
        features.push("10 Go de stockage");
    } else if (plan.max_storage_mb >= 5000) {
        features.push("5 Go de stockage");
    } else if (plan.max_storage_mb >= 1000) {
        features.push("1 Go de stockage");
    }
    features.push("Signature électronique");
    features.push("Export PDF");
    if (plan.price_per_additional_member > 0) {
        features.push(`+ ${plan.price_per_additional_member.toFixed(2).replace(".", ",")} € HT / membre suppl. / mois`);
    }
    return features;
}

function formatPrice(price: number): string {
    return price.toFixed(2).replace(".", ",");
}

/*
const faqItems = [
    {
        question: 'Comment créer mon premier devis ?',
        answer:
            'Après avoir créé votre compte, accédez à la section "Devis" puis cliquez sur "Nouveau devis". Remplissez les informations de votre client, ajoutez vos produits ou services, et le tour est joué !',
    },
    {
        question: 'Comment fonctionne la signature électronique ?',
        answer:
            'Lorsque vous envoyez un devis, votre client reçoit un lien sécurisé. Il peut alors le visualiser et le signer directement en ligne avec son curseur. La signature est horodatée et enregistrée.',
    },
    {
        question: 'Puis-je personnaliser mes documents ?',
        answer:
            'Oui ! Vous pouvez ajouter votre logo, vos conditions générales de vente, personnaliser les couleurs et les mentions légales de vos devis et factures.',
    },
    {
        question: 'Comment sont calculés les tarifs ?',
        answer:
            'Nos tarifs sont mensuels, sans engagement. Le plan Free est gratuit et vous permet de tester la solution. Les plans Pro et Enterprise offrent plus de fonctionnalités pour les professionnels.',
    },
    {
        question: 'Mes données sont-elles sécurisées ?',
        answer:
            'Absolument. Vos données sont stockées sur des serveurs sécurisés en France. Nous utilisons un chiffrement SSL pour toutes les communications et vos données sont sauvegardées quotidiennement.',
    },
];
*/

export function HomePage() {
    const [isAuthChecked, setIsAuthChecked] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

    useEffect(() => {
        const token = localStorage.getItem("sb-access-token");
        if (token) {
            window.location.href = "/dashboard";
        } else {
            setIsAuthChecked(true);
        }
    }, []);

    useEffect(() => {
        subscriptionService.getPlans()
            .then(({ plans }) => setPlans(plans))
            .catch((err) => console.error("Erreur chargement plans:", err));
    }, []);

    if (!isAuthChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <PublicNavbar />

            <main className="flex-1">
                {/* Hero — 2 colonnes */}
                <section className="relative py-20 md:py-32">
                    <div className="container mx-auto px-4">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            {/* Gauche */}
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                    TPE/PME/Professionnels
                                </p>
                                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                                    L'outil qui réunit vos{" "}
                                    <span className="text-primary">
                                        finances
                                    </span>
                                    , votre{" "}
                                    <span className="text-primary">
                                        comptabilité
                                    </span>{" "}
                                    et votre{" "}
                                    <span className="text-primary">
                                        compte pro
                                    </span>
                                </h1>
                                <div className="mt-8">
                                    <Link to="/auth/register">
                                        <Button
                                            size="lg"
                                            className="rounded-full"
                                        >
                                            Démarrer maintenant
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                                {/* Badges notation — Google & Trustpilot */}
                                <div className="mt-8 inline-flex flex-col gap-3 rounded-xl bg-muted/60 px-5 py-4">
                                    {/* Google */}
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="text-xl font-bold text-foreground leading-none"
                                            style={{
                                                fontFamily:
                                                    "'Google Sans', 'Product Sans', sans-serif",
                                            }}
                                        >
                                            G
                                        </span>
                                        <span className="text-sm font-semibold text-foreground">
                                            4.7/5
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4].map((i) => (
                                                <Star
                                                    key={i}
                                                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                                                />
                                            ))}
                                            <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                            >
                                                <defs>
                                                    <linearGradient id="half-yellow">
                                                        <stop
                                                            offset="50%"
                                                            stopColor="#facc15"
                                                        />
                                                        <stop
                                                            offset="50%"
                                                            stopColor="transparent"
                                                        />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                    fill="url(#half-yellow)"
                                                    stroke="#facc15"
                                                    strokeWidth="1"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    {/* Trustpilot */}
                                    <div className="flex items-center gap-3">
                                        <svg
                                            className="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                fill="#00b67a"
                                            />
                                        </svg>
                                        <span className="text-sm font-semibold text-foreground">
                                            4.5/5
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4].map((i) => (
                                                <Star
                                                    key={i}
                                                    className="h-4 w-4 fill-emerald-500 text-emerald-500"
                                                />
                                            ))}
                                            <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                            >
                                                <defs>
                                                    <linearGradient id="half-green">
                                                        <stop
                                                            offset="50%"
                                                            stopColor="#10b981"
                                                        />
                                                        <stop
                                                            offset="50%"
                                                            stopColor="transparent"
                                                        />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                    fill="url(#half-green)"
                                                    stroke="#10b981"
                                                    strokeWidth="1"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Droite — Bento visuel */}
                            <div
                                className="hidden md:block relative w-full max-w-lg ml-auto"
                                style={{ minHeight: "480px" }}
                            >
                                {/* Carte SENED — top left */}
                                <div className="absolute top-0 left-0 w-56 rounded-2xl bg-white dark:bg-card border border-border/60 shadow-lg p-4 z-10">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                                            <span className="text-sm font-bold text-primary-foreground">
                                                S
                                            </span>
                                        </div>
                                        <span className="font-semibold text-foreground text-sm">
                                            SENED
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                        +2 450 € ce mois-ci
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Gérez vos factures en toute simplicité
                                    </p>
                                </div>

                                {/* Image bloc — top right (scrabble) */}
                                <div className="absolute top-0 right-0 w-48 h-36 rounded-2xl shadow-lg overflow-hidden">
                                    <img
                                        src="https://images.unsplash.com/photo-1577455547126-faa6d0f7a8d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
                                        alt="Business"
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Phone mockup — center */}
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-44">
                                    <div className="relative rounded-[2rem] bg-gray-900 p-2 shadow-2xl border-2 border-gray-700">
                                        {/* Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-b-xl z-30" />
                                        {/* Screen */}
                                        <div
                                            className="rounded-[1.5rem] overflow-hidden"
                                            style={{ minHeight: "280px" }}
                                        >
                                            <img
                                                src="https://images.unsplash.com/photo-1587400873558-dfac934a6051?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
                                                alt="Mobile accounting"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        {/* Home indicator */}
                                        <div className="flex justify-center mt-1">
                                            <div className="w-10 h-1 rounded-full bg-gray-600" />
                                        </div>
                                    </div>
                                </div>

                                {/* Badge Certifié — middle right */}
                                <div className="absolute top-48 right-4 z-30 w-24 h-24 rounded-full bg-white dark:bg-card border border-border/60 shadow-lg flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        Certifié
                                    </span>
                                    <span className="text-xl font-bold text-primary">
                                        100%
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Conforme
                                    </span>
                                </div>

                                {/* Mini chart — bottom right */}
                                <div className="absolute bottom-0 right-6 z-10 w-36 h-24 rounded-xl shadow-lg overflow-hidden">
                                    <img
                                        src="https://images.unsplash.com/photo-1762279389020-eeeb69c25813?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=300"
                                        alt="Financial charts"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features — 3 cartes */}
                <section id="features" className="py-20 bg-muted/30">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Tout ce dont vous avez besoin
                            </h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                Une solution complète pour gérer votre activité
                            </p>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {features.map((feature) => (
                                <Card
                                    key={feature.title}
                                    className="bg-background border-border/50"
                                >
                                    <CardHeader>
                                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                            <feature.icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <CardTitle className="text-lg">
                                            {feature.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription>
                                            {feature.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section id="pricing" className="py-20">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Des tarifs adaptés à vos besoins
                            </h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                Choisissez entre un abonnement mensuel ou annuel. Tous les prix sont HT.
                            </p>
                        </div>
                        <div className="mb-8 flex items-center justify-center">
                            <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
                                <button
                                    type="button"
                                    onClick={() => setBillingPeriod("monthly")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        billingPeriod === "monthly"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Mensuel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingPeriod("yearly")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        billingPeriod === "yearly"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Annuel
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
                            {plans.map((plan) => {
                                const isPopular = plan.slug === HIGHLIGHT_SLUG;
                                const price = billingPeriod === "yearly" ? plan.price_yearly : plan.price_monthly;
                                const periodLabel = billingPeriod === "yearly" ? " HT/an" : " HT/mois";
                                const features = buildPlanFeatures(plan);
                                return (
                                    <Card
                                        key={plan.slug}
                                        className={`relative ${
                                            isPopular
                                                ? "border-primary shadow-lg scale-105"
                                                : "border-border/50"
                                        }`}
                                    >
                                        {isPopular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <Badge>Populaire</Badge>
                                            </div>
                                        )}
                                        <CardHeader className="text-center">
                                            <CardTitle>{plan.name}</CardTitle>
                                            <CardDescription>
                                                {plan.description || ""}
                                            </CardDescription>
                                            <div className="mt-4">
                                                <span className="text-4xl font-bold">
                                                    {formatPrice(price)}&euro;
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {periodLabel}
                                                </span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <ul className="space-y-2">
                                                {features.map((feature) => (
                                                    <li
                                                        key={feature}
                                                        className="flex items-center gap-2 text-sm"
                                                    >
                                                        <Check className="h-4 w-4 text-primary" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                            <Link
                                                to="/auth/register"
                                                className="block"
                                            >
                                                <Button
                                                    className="w-full"
                                                    variant={
                                                        isPopular
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                >
                                                    Choisir {plan.name}
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* FAQ — désactivé temporairement
                <section id="faq" className="py-20 bg-muted/30">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Questions fréquentes
                            </h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                Tout ce que vous devez savoir sur SENED
                            </p>
                        </div>
                        <div className="max-w-3xl mx-auto">
                            <Accordion type="single" collapsible className="w-full">
                                {faqItems.map((item, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger className="text-left">
                                            {item.question}
                                        </AccordionTrigger>
                                        <AccordionContent className="text-muted-foreground">
                                            {item.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </div>
                </section>
                */}

                {/* CTA final */}
                <section className="py-20">
                    <div className="container mx-auto px-4">
                        <div className="mx-auto max-w-3xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Prêt à simplifier votre facturation ?
                            </h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                Rejoignez des milliers de professionnels qui
                                font confiance à SENED.
                            </p>
                            <div className="mt-8">
                                <Link to="/auth/register">
                                    <Button size="lg" className="rounded-full">
                                        Démarrer maintenant
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* <PublicFooter /> */}
        </div>
    );
}
