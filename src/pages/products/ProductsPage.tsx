import { useState, useEffect, useCallback } from 'react';
import { 
    Package, 
    Plus, 
    Search, 
    MoreVertical,
    Edit,
    Trash2,
    Loader2,
    Building2,
    Power,
    PowerOff,
    LayoutGrid,
    List,
    Tag,
    X,
    Palette,
    Filter,
    Copy,
    ChevronDown,
    Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useWebSocketEvent } from '@/context/WebSocketContext';
import { productService, categoryService } from '@/services/api';
import type { Product, ProductCategory } from '@/types';
import { cn, dedupeById, upsertById } from '@/lib/utils';
import { useOperationalCompany } from '@/hooks/useOperationalCompany';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';

type ViewMode = 'list' | 'grid';

/**
 * Page de gestion des produits/services
 * Nécessite la sélection d'une entreprise
 */
export function ProductsPage() {
    const { toast } = useToast();
    const { operationalCompany: currentCompany } = useOperationalCompany();
    const permissions = usePermissions(currentCompany?.role, currentCompany?.company_owner_role);
    const { isReadOnly } = useSubscription();
    
    // États pour les produits
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalProducts, setTotalProducts] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    
    // États pour les dialogs
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // États pour les catégories
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
    const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);

    // Chargement des produits quand l'entreprise change
    useEffect(() => {
        if (currentCompany) {
            loadProducts();
            loadCategories();
        } else {
            setProducts([]);
            setTotalProducts(0);
            setCategories([]);
        }
    }, [currentCompany]);

    const loadCategories = async () => {
        if (!currentCompany) return;
        
        try {
            setCategoriesLoading(true);
            const response = await categoryService.getAll(currentCompany.id);
            setCategories(dedupeById(response.categories));
        } catch (error) {
            console.error('Erreur chargement catégories:', error);
        } finally {
            setCategoriesLoading(false);
        }
    };

    const loadProducts = useCallback(async () => {
        if (!currentCompany) return;
        
        try {
            setProductsLoading(true);
            const response = await productService.getAll(currentCompany.id, {
                search: searchQuery || undefined,
                limit: 100,
            });
            setProducts(response.products);
            setTotalProducts(response.total);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de charger les produits',
            });
        } finally {
            setProductsLoading(false);
        }
    }, [currentCompany, searchQuery, toast]);

    // Recherche avec debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentCompany) {
                loadProducts();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, currentCompany, loadProducts]);

    // Écouter les événements WebSocket pour les produits
    useWebSocketEvent<Product>('product:created', (newProduct) => {
        if (currentCompany && newProduct.company_id === currentCompany.id) {
            setProducts(prev => [newProduct, ...prev]);
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<Product>('product:updated', (updatedProduct) => {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    }, []);

    useWebSocketEvent<{ id: string }>('product:deleted', ({ id }) => {
        setProducts(prev => prev.filter(p => p.id !== id));
    }, []);

    // Écouter les événements WebSocket pour les catégories
    useWebSocketEvent<ProductCategory>('category:created', (newCategory) => {
        if (currentCompany && newCategory.company_id === currentCompany.id) {
            setCategories(prev => upsertById(prev, newCategory));
        }
    }, [currentCompany?.id]);

    useWebSocketEvent<ProductCategory>('category:updated', (updatedCategory) => {
        setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
    }, []);

    useWebSocketEvent<{ id: string }>('category:deleted', ({ id }) => {
        setCategories(prev => prev.filter(c => c.id !== id));
    }, []);

    // Édition de produit
    const openEditDialog = useCallback((product: Product) => {
        setProductToEdit(product);
        setIsEditDialogOpen(true);
    }, []);

    // Activation/Désactivation
    const handleToggleActive = async (product: Product) => {
        if (!currentCompany) return;

        try {
            const updatedProduct = await productService.toggleActive(
                currentCompany.id,
                product.id,
                !product.is_active
            );
            setProducts(prev => 
                prev.map(p => p.id === updatedProduct.id ? updatedProduct : p)
            );
            toast({
                title: 'Succès',
                description: `Produit ${updatedProduct.is_active ? 'activé' : 'désactivé'}`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de modifier le statut',
            });
        }
    };

    // Suppression
    const handleDeleteProduct = async () => {
        if (!currentCompany || !productToDelete) return;

        try {
            setIsSubmitting(true);
            await productService.delete(currentCompany.id, productToDelete.id);
            // Le WebSocket s'occupe de supprimer le produit de la liste
            setTotalProducts(prev => prev - 1);
            setIsDeleteDialogOpen(false);
            setProductToDelete(null);
            toast({
                title: 'Succès',
                description: 'Produit supprimé avec succès',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer le produit',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Duplication
    const handleDuplicateProduct = async (product: Product) => {
        if (!currentCompany) return;

        try {
            setIsSubmitting(true);
            await productService.duplicate(currentCompany.id, product.id);
            // Le WebSocket s'occupe d'ajouter le produit dupliqué
            setTotalProducts(prev => prev + 1);
            toast({
                title: 'Succès',
                description: `Produit "${product.name}" dupliqué avec succès`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de dupliquer le produit',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Suppression de catégorie
    const handleDeleteCategory = async () => {
        if (!currentCompany || !categoryToDelete) return;

        try {
            setIsSubmitting(true);
            await categoryService.delete(currentCompany.id, categoryToDelete.id);
            setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
            setIsDeleteCategoryDialogOpen(false);
            setCategoryToDelete(null);
            toast({
                title: 'Succès',
                description: 'Catégorie supprimée avec succès',
            });
            // Recharger les produits car certains peuvent avoir perdu leur catégorie
            loadProducts();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer la catégorie',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtrer les produits par catégorie
    const filteredProducts = filterCategoryId 
        ? products.filter(p => p.category_id === filterCategoryId)
        : products;

    // Formater le prix
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    };

    // Aucune entreprise sélectionnée
    if (!currentCompany) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Produits & Services</h1>
                    <p className="text-muted-foreground">Gérez votre catalogue</p>
                </div>
                
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mb-2 text-lg font-medium">Aucune entreprise sélectionnée</h3>
                        <p className="mb-4 text-muted-foreground">
                            Veuillez sélectionner une entreprise dans le menu pour gérer vos produits.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Composant carte produit - Design moderne avec toutes les infos
    const ProductCard = ({ product }: { product: Product }) => (
        <Card 
            className={cn(
                "group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20 cursor-pointer",
                !product.is_active && "opacity-60 bg-muted/30"
            )}
            onClick={() => openEditDialog(product)}
        >
            {/* Barre de couleur catégorie en haut */}
            <div 
                className="h-1.5 w-full"
                style={{ backgroundColor: product.category?.color || '#e5e7eb' }}
            />
            
            <CardContent className="p-4">
                {/* Header avec nom et actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base line-clamp-1">{product.name}</h3>
                        {product.reference && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Réf: {product.reference}
                            </p>
                        )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {permissions.canEditProduct && (
                                    <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Modifier
                                    </DropdownMenuItem>
                                )}
                                {permissions.canCreateProduct && (
                                    <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        Dupliquer
                                    </DropdownMenuItem>
                                )}
                                {permissions.canEditProduct && (
                                    <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                                        {product.is_active ? (
                                            <>
                                                <PowerOff className="mr-2 h-4 w-4" />
                                                Désactiver
                                            </>
                                        ) : (
                                            <>
                                                <Power className="mr-2 h-4 w-4" />
                                                Activer
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                )}
                                {permissions.canDeleteProduct && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            onClick={() => {
                                                setProductToDelete(product);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Supprimer
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-3 min-h-[40px]">
                    {product.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground/50 italic">
                            Pas de description
                        </p>
                    )}
                </div>

                {/* Badges catégorie et statut */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {product.category && (
                        <Badge 
                            variant="secondary" 
                            className="gap-1 text-xs font-medium"
                            style={{ 
                                backgroundColor: `${product.category.color}15`,
                                borderColor: product.category.color,
                                color: product.category.color,
                                border: '1px solid'
                            }}
                        >
                            <Tag className="h-3 w-3" />
                            {product.category.name}
                        </Badge>
                    )}
                    {!product.category && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                            Sans catégorie
                        </Badge>
                    )}
                    {!product.is_active && (
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <PowerOff className="h-3 w-3 mr-1" />
                            Inactif
                        </Badge>
                    )}
                </div>

                {/* Prix - Section séparée */}
                <div className="grid grid-cols-2 gap-3 p-3 -mx-4 -mb-4 bg-muted/30 border-t">
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prix HT</p>
                        <p className="text-lg font-bold text-primary">
                            {formatPrice(
                                product.has_multi_tax && product.tax_lines?.length
                                    ? product.tax_lines.reduce((sum: number, tl: any) => sum + tl.amount, 0)
                                    : product.unit_price
                            )}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prix TTC</p>
                        <p className="text-base font-semibold">
                            {formatPrice(
                                product.has_multi_tax && product.tax_lines?.length
                                    ? product.tax_lines.reduce((sum: number, tl: any) => sum + tl.amount * (1 + tl.tax_rate / 100), 0)
                                    : product.unit_price * (1 + product.vat_rate / 100)
                            )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            {product.has_multi_tax && product.tax_lines?.length ? 'Multi-taux' : `TVA ${product.vat_rate}%`}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Composant ligne produit (vue liste) - Design tableau moderne
    const ProductRow = ({ product }: { product: Product }) => (
        <div
            className={cn(
                "group flex items-center gap-4 rounded-lg border p-4 transition-all hover:bg-muted/50 hover:border-primary/20 cursor-pointer",
                !product.is_active && "opacity-60 bg-muted/30"
            )}
            onClick={() => openEditDialog(product)}
        >
            {/* Indicateur couleur catégorie */}
            <div 
                className="w-1 h-12 rounded-full flex-shrink-0"
                style={{ backgroundColor: product.category?.color || '#e5e7eb' }}
            />
            
            {/* Nom et référence */}
            <div className="min-w-0 w-48 flex-shrink-0">
                <h4 className="font-medium truncate">{product.name}</h4>
                {product.reference && (
                    <p className="text-xs text-muted-foreground truncate">Réf: {product.reference}</p>
                )}
            </div>

            {/* Catégorie */}
            <div className="w-32 flex-shrink-0">
                {product.category ? (
                    <Badge 
                        variant="secondary" 
                        className="gap-1 text-xs font-medium"
                        style={{ 
                            backgroundColor: `${product.category.color}15`,
                            borderColor: product.category.color,
                            color: product.category.color,
                            border: '1px solid'
                        }}
                    >
                        <Tag className="h-3 w-3" />
                        {product.category.name}
                    </Badge>
                ) : (
                    <span className="text-xs text-muted-foreground italic">-</span>
                )}
            </div>

            {/* Description - flexible, prend l'espace restant */}
            <div className="hidden lg:block flex-1 min-w-0">
                {product.description ? (
                    <p className="text-sm text-muted-foreground truncate">
                        {product.description}
                    </p>
                ) : (
                    <span className="text-sm text-muted-foreground/50 italic">-</span>
                )}
            </div>

            {/* Statut */}
            <div className="w-24 flex-shrink-0 flex justify-center">
                {product.is_active ? (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                        <Power className="h-3 w-3 mr-1" />
                        Actif
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <PowerOff className="h-3 w-3 mr-1" />
                        Inactif
                    </Badge>
                )}
            </div>

            {/* Prix */}
            <div className="w-28 flex-shrink-0 text-right">
                <p className="font-semibold text-primary">
                    {formatPrice(
                        product.has_multi_tax && product.tax_lines?.length
                            ? product.tax_lines.reduce((sum: number, tl: any) => sum + tl.amount, 0)
                            : product.unit_price
                    )}
                </p>
                <p className="text-xs text-muted-foreground">
                    TTC: {formatPrice(
                        product.has_multi_tax && product.tax_lines?.length
                            ? product.tax_lines.reduce((sum: number, tl: any) => sum + tl.amount * (1 + tl.tax_rate / 100), 0)
                            : product.unit_price * (1 + product.vat_rate / 100)
                    )} ({product.has_multi_tax && product.tax_lines?.length ? 'Multi' : `${product.vat_rate}%`})
                </p>
            </div>

            {/* Actions - toujours à droite */}
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {permissions.canEditProduct && (
                            <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                            </DropdownMenuItem>
                        )}
                        {permissions.canCreateProduct && (
                            <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Dupliquer
                            </DropdownMenuItem>
                        )}
                        {permissions.canEditProduct && (
                            <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                                {product.is_active ? (
                                    <>
                                        <PowerOff className="mr-2 h-4 w-4" />
                                        Désactiver
                                    </>
                                ) : (
                                    <>
                                        <Power className="mr-2 h-4 w-4" />
                                        Activer
                                    </>
                                )}
                            </DropdownMenuItem>
                        )}
                        {permissions.canDeleteProduct && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => {
                                        setProductToDelete(product);
                                        setIsDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold">Produits & Services</h1>
                    <p className="text-muted-foreground">Gérez votre catalogue</p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                    <Button 
                        variant="outline"
                        onClick={() => setIsCategoryManagerOpen(true)}
                        disabled={!currentCompany}
                        className="w-full sm:w-auto"
                    >
                        <Tag className="mr-2 h-4 w-4" />
                        Catégories ({categories.length})
                    </Button>
                    {permissions.canCreateProduct && (
                        <Button
                            onClick={() => setIsCreateDialogOpen(true)}
                            disabled={!currentCompany || isReadOnly}
                            title={isReadOnly ? 'Abonnement requis' : undefined}
                            className="w-full sm:w-auto"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nouveau produit
                        </Button>
                    )}
                </div>
            </div>

            {/* Liste des produits */}
            {currentCompany && (
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col gap-4">
                            {/* Titre et compteur */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="h-5 w-5 shrink-0" />
                                        <span className="truncate">Votre catalogue</span>
                                    </CardTitle>
                                    <CardDescription className="truncate">
                                        {totalProducts} produit{totalProducts > 1 ? 's' : ''} pour {currentCompany.name}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Toggle vue */}
                                    <ToggleGroup 
                                        type="single" 
                                        value={viewMode} 
                                        onValueChange={(value) => value && setViewMode(value as ViewMode)}
                                        className="border rounded-lg"
                                    >
                                        <ToggleGroupItem value="grid" aria-label="Vue grille" className="px-3">
                                            <LayoutGrid className="h-4 w-4" />
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="list" aria-label="Vue liste" className="px-3">
                                            <List className="h-4 w-4" />
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </div>
                            
                            {/* Barre de filtres */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Recherche */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher un produit..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                
                                {/* Filtre par catégorie */}
                                {categories.length > 0 && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full sm:w-auto justify-between min-w-[180px]">
                                                <div className="flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    {filterCategoryId ? (
                                                        <div className="flex items-center gap-2">
                                                            <div 
                                                                className="h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: categories.find(c => c.id === filterCategoryId)?.color }}
                                                            />
                                                            <span className="truncate max-w-[100px]">
                                                                {categories.find(c => c.id === filterCategoryId)?.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>Toutes catégories</span>
                                                    )}
                                                </div>
                                                <ChevronDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[220px] p-2" align="end">
                                            <div className="space-y-1">
                                                <button
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                                                        !filterCategoryId && "bg-accent"
                                                    )}
                                                    onClick={() => setFilterCategoryId(null)}
                                                >
                                                    <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                                                    <span>Toutes les catégories</span>
                                                    {!filterCategoryId && <Check className="h-4 w-4 ml-auto" />}
                                                </button>
                                                <Separator className="my-1" />
                                                {categories.map((category) => (
                                                    <button
                                                        key={category.id}
                                                        className={cn(
                                                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                                                            filterCategoryId === category.id && "bg-accent"
                                                        )}
                                                        onClick={() => setFilterCategoryId(category.id)}
                                                    >
                                                        <div 
                                                            className="h-3 w-3 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: category.color }}
                                                        />
                                                        <span className="truncate">{category.name}</span>
                                                        {filterCategoryId === category.id && (
                                                            <Check className="h-4 w-4 ml-auto flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                            
                            {/* Tags de filtres actifs */}
                            {filterCategoryId && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Filtré par:</span>
                                    <Badge 
                                        variant="secondary"
                                        className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
                                        style={{ 
                                            backgroundColor: `${categories.find(c => c.id === filterCategoryId)?.color}15`,
                                            borderColor: categories.find(c => c.id === filterCategoryId)?.color,
                                            color: categories.find(c => c.id === filterCategoryId)?.color,
                                            border: '1px solid'
                                        }}
                                        onClick={() => setFilterCategoryId(null)}
                                    >
                                        <Tag className="h-3 w-3" />
                                        {categories.find(c => c.id === filterCategoryId)?.name}
                                        <X className="h-3 w-3 ml-1" />
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {productsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
                                <h3 className="mb-2 text-lg font-medium">
                                    {searchQuery || filterCategoryId ? 'Aucun résultat' : 'Aucun produit'}
                                </h3>
                                <p className="mb-4 text-muted-foreground">
                                    {searchQuery || filterCategoryId
                                        ? 'Aucun produit ne correspond à vos critères de recherche.'
                                        : 'Ajoutez vos produits et services pour les inclure dans vos devis.'
                                    }
                                </p>
                                {!searchQuery && !filterCategoryId && (
                                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Ajouter un produit
                                    </Button>
                                )}
                                {filterCategoryId && (
                                    <Button variant="outline" onClick={() => setFilterCategoryId(null)}>
                                        <X className="mr-2 h-4 w-4" />
                                        Effacer le filtre
                                    </Button>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            /* Vue grille */
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            /* Vue liste avec header */
                            <div className="space-y-2">
                                {/* Header du tableau */}
                                <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                                    <div className="w-1" /> {/* Espace pour indicateur couleur */}
                                    <div className="w-48">Produit</div>
                                    <div className="w-32">Catégorie</div>
                                    <div className="hidden lg:block flex-1">Description</div>
                                    <div className="w-24 text-center">Statut</div>
                                    <div className="w-28 text-right">Prix</div>
                                    <div className="w-8" /> {/* Espace pour actions */}
                                </div>
                                {/* Liste des produits */}
                                {filteredProducts.map((product) => (
                                    <ProductRow key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialog de création */}
            <ProductFormDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                companyId={currentCompany.id}
                initialCategories={categories}
                onSuccess={() => setTotalProducts(prev => prev + 1)}
            />

            {/* Dialog d'édition */}
            <ProductFormDialog
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsEditDialogOpen(open);
                    if (!open) setProductToEdit(null);
                }}
                companyId={currentCompany.id}
                productToEdit={productToEdit}
                initialCategories={categories}
            />

            {/* Dialog de confirmation de suppression */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer <strong>{productToDelete?.name}</strong> ?
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProduct}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog de gestion des catégories */}
            <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Gérer les catégories
                        </DialogTitle>
                        <DialogDescription>
                            {categories.length} catégorie{categories.length > 1 ? 's' : ''} pour {currentCompany?.name}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        {categoriesLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Aucune catégorie créée</p>
                                <p className="text-sm mt-1">
                                    Créez une catégorie lors de l'ajout d'un produit
                                </p>
                            </div>
                        ) : (
                            <ScrollArea className="max-h-[300px]">
                                <div className="space-y-2">
                                    {categories.map((category) => (
                                        <div 
                                            key={category.id}
                                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="h-4 w-4 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: category.color }}
                                                />
                                                <span className="font-medium">{category.name}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    setCategoryToDelete(category);
                                                    setIsDeleteCategoryDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                    
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCategoryManagerOpen(false)}
                        >
                            Fermer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmation de suppression de catégorie */}
            <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer la catégorie{' '}
                            <Badge 
                                variant="secondary"
                                style={{ 
                                    backgroundColor: `${categoryToDelete?.color}20`,
                                    borderColor: categoryToDelete?.color,
                                    color: categoryToDelete?.color
                                }}
                            >
                                {categoryToDelete?.name}
                            </Badge>{' '}
                            ? Les produits associés perdront leur catégorie.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCategory}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
