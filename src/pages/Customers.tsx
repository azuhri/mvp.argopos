import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Users as UsersIcon, Briefcase, Pencil, Trash2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { storeService } from "@/lib/services/storeService";
import { userService } from "@/lib/services/userService";
import { Transaction } from "@/lib/api";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "internal" | "external";
  status: "active" | "inactive";
  created_at?: string;
  employee_id?: string;
  koperasi_id?: string;
}

export default function Customers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");

  // Fetch full user data to get assigned_stores
  const { data: fullUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => userService.getCurrentUser(),
  });

  // Get the first assigned store location_id if user has assigned stores
  const assignedStoreId = fullUser?.assigned_stores && fullUser.assigned_stores.length > 0 
    ? fullUser.assigned_stores[0].id 
    : null;

  // Fetch transactions for the assigned store to get customers
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['store-transactions', assignedStoreId],
    queryFn: () => assignedStoreId 
      ? storeService.getStoreTransactions(assignedStoreId, { page: 1, page_size: 1000 })
      : Promise.resolve({ transactions: [], total: 0 }),
    enabled: !!assignedStoreId,
  });

  // Extract unique customers from transactions
  const customers = (() => {
    if (!transactionsData?.transactions) return [];
    const uniqueCustomers = new Map<string, Customer>();
    
    transactionsData.transactions.forEach((trx: Transaction) => {
      if (trx.customer_id && trx.customer_name) {
        const customerId = trx.customer_id;
        if (!uniqueCustomers.has(customerId)) {
          uniqueCustomers.set(customerId, {
            id: customerId,
            name: trx.customer_name,
            email: '', // Transaction doesn't have email
            phone: '', // Transaction doesn't have phone
            type: 'external',
            status: 'active',
            created_at: trx.created_at,
          });
        }
      }
    });
    
    return Array.from(uniqueCustomers.values());
  })();

  const filtered = customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <AppLayout title="Customers">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
      </div>

      {isLoading ? (
        <GlassCard className="p-4">
          <p className="text-center text-muted-foreground">Loading...</p>
        </GlassCard>
      ) : !assignedStoreId ? (
        <GlassCard className="p-4">
          <p className="text-center text-muted-foreground">No assigned store found</p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-4">
          <p className="text-center text-muted-foreground">No customers found</p>
        </GlassCard>
      ) : (
        /* Desktop Table */
        <div className="hidden md:block">
          <GlassCard className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium">{customer.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{customer.type}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={customer.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="md:hidden grid gap-3">
        {filtered.map((customer) => (
          <GlassCard key={customer.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{customer.name}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{customer.type}</Badge>
                  <StatusBadge status={customer.status} />
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </AppLayout>
  );
}
