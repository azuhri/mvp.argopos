import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, User, Eye, Search } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { storeService } from "@/lib/services/storeService";
import { Store } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function KoperasiPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);
      const metrics = await storeService.getAllStoresMetrics();
      const storeDetails = await Promise.all(
        metrics.map(async (metric) => {
          try {
            return await storeService.getStoreDetail(metric.location_id);
          } catch {
            return null;
          }
        })
      );
      // Debug: Log all stores and user
      console.log("All stores:", storeDetails);
      console.log("Current user:", user);

      // Filter stores to only show those assigned to current user
      // Super admin should see all stores
      const assignedStores = storeDetails.filter((s): s is Store => {
        if (!s || !user) return false;

        // Super admin can see all stores
        if (user.role === 'super_admin') {
          console.log(`Store ${s.location_name} visible to super admin`);
          return true;
        }

        // For other roles, check assignment
        if (!s.assigned_users || s.assigned_users.length === 0) {
          console.log(`Store ${s.location_name} has no assigned users`);
          return false;
        }

        const isAssigned = s.assigned_users.some((assignedUser) => assignedUser.id === user.id);
        console.log(`Store ${s.location_name} assigned to user ${user.id}:`, isAssigned, "Assigned users:", s.assigned_users);
        return isAssigned;
      });

      console.log("Assigned stores:", assignedStores);
      setStores(assignedStores);
    } catch (error) {
      toast.error("Failed to load stores");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = stores.filter((s) =>
    s.location_name.toLowerCase().includes(search.toLowerCase()) || s.location_code.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (store: Store) => {
    navigate(`/master/koperasi/${store.location_id}`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <AppLayout title="Koperasi">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari koperasi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/70 backdrop-blur border-border/50" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{filtered.length} koperasi ditemukan</p>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40 animate-pulse" />
          <p>Loading...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((store, i) => (
              <GlassCard key={store.location_id} hover delay={i * 0.08}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{store.location_name}</h3>
                      <p className="text-xs text-muted-foreground">{store.location_code}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Transaksi</p>
                    <p className="text-lg font-bold text-foreground">
                      <AnimatedCounter end={store.total_transactions} />
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold text-foreground">
                      <AnimatedCounter end={store.total_revenue / 1000000} suffix="M" decimals={1} prefix="Rp " />
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1 min-w-0">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{store.assigned_users?.length || 0} User</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-3 border-t border-border/30">
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => openDetail(store)}>
                    <Eye className="h-3 w-3 mr-1" /> Detail
                  </Button>
                </div>
              </GlassCard>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Tidak ada koperasi ditemukan</p>
        </div>
      )}
    </AppLayout>
  );
}
