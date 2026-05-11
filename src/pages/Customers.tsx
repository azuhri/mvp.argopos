import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaWhatsapp } from "react-icons/fa";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Users as UsersIcon, Briefcase, Pencil, Trash2, Eye, MessageCircle } from "lucide-react";
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
  no_wa?: string;
  employee_code?: string;
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
          // Determine customer type based on employee_code
          const isInternal = !!trx.customer_employee_code;
          uniqueCustomers.set(customerId, {
            id: customerId,
            name: trx.customer_name,
            email: trx.customer_email || '',
            phone: '', // Transaction doesn't have phone
            no_wa: trx.customer_no_wa,
            employee_code: trx.customer_employee_code,
            type: isInternal ? 'internal' : 'external',
            status: 'active',
            created_at: trx.created_at,
          });
        }
      }
    });

    return Array.from(uniqueCustomers.values());
  })();

  // Helper function to open WhatsApp
  const handleWhatsAppClick = (noWa?: string) => {
    if (noWa) {
      // Remove any non-digit characters and ensure Indonesian format
      const cleanedNoWa = noWa.replace(/\D/g, '');
      const formattedNoWa = cleanedNoWa.startsWith('0') ? '62' + cleanedNoWa.substring(1) : cleanedNoWa;
      window.open(`https://wa.me/${formattedNoWa}`, '_blank');
    }
  };

  // Helper function to get customer type badge variant
  const getCustomerTypeBadge = (type: "internal" | "external") => {
    return type === "internal" ? (
      <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Internal</Badge>
    ) : (
      <Badge variant="outline">External</Badge>
    );
  };

  const filtered = customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <AppLayout title="Customers">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
          <Input
            placeholder="Cari customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/70 backdrop-blur border-border/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "internal" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("internal")}
            >
              Internal
            </Button>
            <Button
              variant={filter === "external" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("external")}
            >
              External
            </Button>
          </div>
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
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">No WA</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium">{customer.name}</td>
                    <td className="py-3 px-4 font-medium">{customer.email || '-'}</td>
                    <td className="py-3 px-4 font-medium">{customer.no_wa || '-'}</td>
                    <td className="py-3 px-4">
                      {getCustomerTypeBadge(customer.type)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="py-3 px-4">
                      {customer.no_wa && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleWhatsAppClick(customer.no_wa)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <FaWhatsapp className="h-6 w-6" />
                        </Button>
                      )}
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
            <div className="items-start justify-between">
              <div className="flex gap-2 flex-col ">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Name</span>
                  <p className="font-semibold text-xs text-foreground">{customer.name}</p>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Email</span>
                  <p className="text-xs text-muted-foreground">{customer.email || '-'}</p>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Phone</span>
                  <p className="text-sm text-muted-foreground">{customer.no_wa || '-'}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  {getCustomerTypeBadge(customer.type)}
                  <StatusBadge status={customer.status} />
                </div>
              </div>
            </div>
            {customer.no_wa && (
              <Button
                className="w-full mt-2 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                variant="secondary"
                size="sm"
                onClick={() => handleWhatsAppClick(customer.no_wa)}
              >
                <FaWhatsapp size={40} strokeWidth={1.5} />
                <span className="font-semibold">Kontak WA</span>
              </Button>
            )}
          </GlassCard>
        ))}
      </div>
    </AppLayout>
  );
}
