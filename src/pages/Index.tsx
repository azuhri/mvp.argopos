import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/constants";
import { apiClient, type DashboardAnalyticsResponse } from "@/lib/api";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, ShoppingCart, DollarSign, ArrowUpRight, type LucideIcon } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

type StatCardConfig = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  changeLabel: string;
  isDelta?: boolean;
  trendPositive?: boolean;
};

const COLORS = [
  "hsl(234, 85%, 60%)",
  "hsl(142, 72%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 65%, 55%)",
];

const DEFAULT_RANGE_DAYS = 30;

const formatDateLabel = (value?: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(value));
};

const buildRangeLabel = (start?: string, end?: string) => {
  if (!start || !end) return "Periode berjalan";
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
};

const formatGrowthLabel = (growth?: number) => {
  if (growth === undefined || Number.isNaN(growth)) {
    return "0.0% vs prev";
  }
  const formatted = growth.toFixed(1);
  const sign = growth > 0 ? "+" : "";
  return `${sign}${formatted}% vs prev`;
};

type BadgeStatus = Parameters<typeof StatusBadge>[0]["status"];
const normalizeBadgeStatus = (status: string): BadgeStatus => {
  const map: Record<string, BadgeStatus> = {
    waiting_payment: "waiting_payment",
    waiting_to_payment: "waiting_payment",
    waiting_to_pay: "waiting_payment",
    preparing_product: "preparing_product",
    ready_to_pickup: "ready_to_pickup",
    completed: "completed",
    paid: "paid",
    hutang: "hutang",
    approved: "approved",
    pending: "pending",
  };
  return map[status] ?? "pending";
};

export default function Dashboard() {
  const { data, isLoading, isError, error } = useQuery<DashboardAnalyticsResponse>({
    queryKey: ["dashboard-analytics", DEFAULT_RANGE_DAYS],
    queryFn: async () => {
      const response = await apiClient.getDashboardAnalytics({ range_days: DEFAULT_RANGE_DAYS });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load dashboard data");
      }
      return response.data;
    },
    staleTime: 60 * 1000,
  });

  const summary = data?.summary;
  const stats = useMemo<StatCardConfig[]>(() => {
    if (!summary) {
      return [
        { label: "Total Revenue", value: 0, prefix: "Rp ", icon: DollarSign, changeLabel: "Menunggu data" },
        { label: "Transactions", value: 0, icon: ShoppingCart, changeLabel: "Menunggu data" },
        { label: "Customers", value: 0, icon: Users, changeLabel: "Menunggu data" },
        { label: "Growth", value: 0, suffix: "%", decimals: 1, icon: TrendingUp, changeLabel: "Menunggu data" },
      ];
    }

    const timeframeLabel = buildRangeLabel(summary.period_start, summary.period_end);
    const growthLabel = formatGrowthLabel(summary.revenue_growth);

    return [
      {
        label: "Total Revenue",
        value: summary.total_revenue,
        prefix: "Rp ",
        icon: DollarSign,
        changeLabel: `${growthLabel} • Prev ${formatCurrency(summary.previous_revenue)}`,
        isDelta: true,
        trendPositive: (summary.revenue_growth ?? 0) >= 0,
      },
      {
        label: "Transactions",
        value: summary.total_transactions,
        icon: ShoppingCart,
        changeLabel: timeframeLabel,
      },
      {
        label: "Customers",
        value: summary.unique_customers,
        icon: Users,
        changeLabel: timeframeLabel,
      },
      {
        label: "Growth",
        value: summary.revenue_growth ?? 0,
        suffix: "%",
        decimals: 1,
        icon: TrendingUp,
        changeLabel: growthLabel,
        isDelta: true,
        trendPositive: (summary.revenue_growth ?? 0) >= 0,
      },
    ];
  }, [summary]);

  const revenueTrend = data?.revenue_trend ?? [];
  const categoryDistribution = data?.category_distribution ?? [];
  const recentTransactions = data?.recent_transactions ?? [];

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <p>Loading analytics...</p>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500">{error?.message || "Gagal memuat data"}</p>
            <p className="text-sm text-muted-foreground mt-2">Silakan coba lagi beberapa saat.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {/* <DashboardMobileNav /> */}
      <div>
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <GlassCard key={stat.label} hover delay={i * 0.08}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <div className="mt-2 text-xl font-bold text-foreground">
                  <AnimatedCounter
                    end={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.isDelta ? (
                    <>
                      <ArrowUpRight className={`h-3 w-3 ${stat.trendPositive ? "text-success" : "text-destructive"}`} />
                      <span className={`text-xs font-medium ${stat.trendPositive ? "text-success" : "text-destructive"}`}>
                        {stat.changeLabel}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{stat.changeLabel}</span>
                  )}
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <GlassCard className="lg:col-span-2" delay={0.3}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(234, 85%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(234, 85%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" opacity={0.5} />
              <XAxis dataKey="label" stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(234, 85%, 60%)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.4}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Categories</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {categoryDistribution.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, _name, payload) => [`${(value as number).toFixed(1)}%`, payload?.payload?.name || "Kategori"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryDistribution.map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {cat.name} <span className="font-medium text-foreground">{cat.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Recent Transactions */}
      <GlassCard delay={0.5}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Invoice</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Customer</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Koperasi</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Total</th>
                <th className="text-center py-3 px-2 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Belum ada transaksi pada periode ini.
                  </td>
                </tr>
              )}
              {recentTransactions.map((tx, i) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-2 font-medium text-foreground">{tx.invoice_number}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{tx.customer_name}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{tx.store_name}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{formatCurrency(tx.total)}</td>
                  <td className="py-3 px-2 text-center">
                    <StatusBadge status={normalizeBadgeStatus(tx.status)} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
      </div>
    </AppLayout>
  );
}
