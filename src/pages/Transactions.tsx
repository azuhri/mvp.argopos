import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mockProducts, mockTransactions, formatCurrency, Product } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, ShoppingCart, Check, X, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";

interface CartItem {
  product: Product;
  qty: number;
}

export default function Transactions() {
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredProducts = mockProducts.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  const handleCheckout = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setCart([]);
    }, 2000);
  };

  return (
    <AppLayout title="Transactions">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["pos", "history"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="btn-tap capitalize"
          >
            {tab === "pos" ? <ShoppingCart className="h-3 w-3 mr-1" /> : null}
            {tab === "pos" ? "New Transaction" : "History"}
          </Button>
        ))}
      </div>

      {activeTab === "pos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Product List */}
          <div className="lg:col-span-3">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="pl-9 bg-card/70 backdrop-blur border-border/50"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => addToCart(p)}
                  className="glass-card-hover p-4 text-left btn-tap"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.stock} {p.unit}</p>
                  <p className="text-sm font-semibold text-primary mt-2">{formatCurrency(p.price)}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-2">
            <GlassCard className="sticky top-20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Cart
                {cart.length > 0 && (
                  <Badge className="ml-auto">{cart.length}</Badge>
                )}
              </h3>

              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Add products to start a transaction
                </p>
              ) : (
                <>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    <AnimatePresence>
                      {cart.map((item) => (
                        <motion.div
                          key={item.product.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <button
                              onClick={() => updateQty(item.product.id, -1)}
                              className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center hover:bg-accent transition-colors btn-tap"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center text-foreground">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.product.id, 1)}
                              className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center hover:bg-accent transition-colors btn-tap"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-foreground ml-3 w-24 text-right">
                            {formatCurrency(item.product.price * item.qty)}
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="text-xl font-bold text-foreground">
                        <AnimatedCounter end={total} prefix="Rp " />
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {(["Cash", "Transfer", "Hutang"] as const).map((method) => (
                        <Button key={method} variant="outline" size="sm" className="btn-tap text-xs">
                          {method}
                        </Button>
                      ))}
                    </div>
                    <Button className="w-full btn-tap" onClick={handleCheckout}>
                      Complete Transaction
                    </Button>
                  </div>
                </>
              )}

              {/* Success Animation */}
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center bg-card/95 backdrop-blur rounded-xl"
                  >
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3"
                      >
                        <Check className="h-8 w-8 text-success" />
                      </motion.div>
                      <p className="font-semibold text-foreground">Transaction Complete!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </div>
        </div>
      ) : (
        /* History */
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Invoice</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Customer</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Payment</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Total</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTransactions.map((tx, i) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3 px-2 font-medium text-foreground">{tx.invoice_number}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{tx.customer_name}</td>
                    <td className="py-3 px-2 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs capitalize">{tx.payment_method}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">{formatCurrency(tx.total)}</td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={tx.status} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </AppLayout>
  );
}
