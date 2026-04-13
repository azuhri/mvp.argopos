import { Search, Bell, LogOut, ShoppingBag } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import { getCartSummary, clearCart } from "@/lib/storefront";
import { useState, useEffect } from "react";

interface TopBarCommerceProps {
    title: string;
}

export function TopBarCommerce({ title }: TopBarCommerceProps) {
    const [cartSummary, setCartSummary] = useState(getCartSummary());
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Update cart summary when localStorage changes
    useEffect(() => {
        const handleStorageChange = () => {
            setCartSummary(getCartSummary());
        };

        window.addEventListener('storage', handleStorageChange);
        const interval = setInterval(handleStorageChange, 100);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    const { items, total, totalItems } = cartSummary;

    const handleClearCart = () => {
        clearCart();
        setCartSummary(getCartSummary()); // Trigger re-render
        toast.success("Keranjang dikosongkan");
    };

    return (
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border/40 glass-strong sticky top-0 z-30">
            <div className="flex gap-2 items-center">
                <Link to="/commerce" className="flex items-center gap-2">
                    <div className="p-2 px-2 rounded-sm bg-primary flex items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h1 className="text-lg font-semibold text-foreground">{title}</h1>
                </Link>
            </div>

            <div className="flex items-center gap-2">
                <ThemeToggle />

                <div className="flex relative">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-9 w-9 rounded-lg bg-primary/10 hover:bg-primary/20">
                                <span className="text-sm font-semibold text-primary">
                                    <ShoppingCartIcon size={20} strokeWidth={2} />
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card w-80 max-w-[calc(100vw-2rem)]">
                            <DropdownMenuItem className="text-primary text-sm focus:text-primary p-0">
                                {/* Cart Items */}
                                <div className="w-full p-2">
                                    {totalItems === 0 ?
                                        (<div className="text-center py-6">
                                            <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-1" />
                                            <h2 className="text-lg font-semibold mb-1">Keranjang Kosong</h2>
                                            <p className="text-muted-foreground mb-4">Belum ada produk di keranjang kamu</p>
                                        </div>
                                        ) : (<div className="flex items-center justify-between mb-3">
                                            <h2 className="text-sm font-semibold">Keranjang ({totalItems})</h2>
                                            <Link to="/commerce/cart" className="text-xs text-primary hover:underline whitespace-nowrap">
                                                Lihat Keranjang
                                            </Link>
                                        </div>)}
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                        <AnimatePresence>
                                            {items.map((item) => (
                                                <motion.div
                                                    key={item.productId}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className="glass-card p-3"
                                                >
                                                    <div className="flex gap-3 items-center">
                                                        <div className="h-12 w-12 sm:h-16 sm:w-16 flex justify-center items-center rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 flex-shrink-0">
                                                            <img
                                                                src={item.product.image_url || ''}
                                                                alt={item.product.name}
                                                                className="h-8 w-8 sm:h-12 sm:w-12 object-cover rounded"
                                                            />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-medium text-xs sm:text-sm line-clamp-1">
                                                                {item.product.name}
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.product.category}
                                                            </p>
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-xs text-muted-foreground">
                                                                    x{item.qty}
                                                                </span>
                                                                <p className="text-xs sm:text-sm font-semibold text-primary">
                                                                    {formatCurrency(item.subtotal)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {items.length > 0 && (
                                        <div className="border-t pt-2 mt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Total:</span>
                                                <span className="text-sm font-semibold text-primary">
                                                    {formatCurrency(total)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {totalItems > 0 && (
                        <p className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {totalItems}
                        </p>
                    )}
                </div>
            </div>
        </header>
    );
}
