import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleAlert,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient, type DashboardAnalyticsResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/constants";

type StatCardConfig = {
  label: string;
  value: string;
  icon: LucideIcon;
  helper: string;
  iconClassName: string;
  compactValue?: boolean;
  isDelta?: boolean;
  trendPositive?: boolean;
};

const CATEGORY_COLORS = ["#071a4f", "#e30613", "#38a6d9", "#279060", "#d89a2b"];
const RANGE_OPTIONS = [7, 30, 90];

const formatDateLabel = (value?: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(value));
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const buildRangeLabel = (start?: string, end?: string) => {
  if (!start || !end) return "Periode berjalan";
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
};

const formatGrowthValue = (growth?: number) => {
  const safeGrowth = growth ?? 0;
  return `${Math.abs(safeGrowth).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const formatGrowthLabel = (growth?: number) => {
  if (growth === undefined || Number.isNaN(growth)) return "0,0% vs periode sebelumnya";
  return `${formatGrowthValue(growth)} vs periode sebelumnya`;
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
  return map[status.toLowerCase()] ?? "pending";
};

function DashboardContentSkeleton() {
  return (
    <div className="space-y-5" aria-label="Memuat data dashboard" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-[360px] rounded-lg xl:col-span-2" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export default function Dashboard() {
  const [rangeDays, setRangeDays] = useState(30);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardAnalyticsResponse>({
    queryKey: ["dashboard-analytics", rangeDays],
    queryFn: async () => {
      const response = await apiClient.getDashboardAnalytics({ range_days: rangeDays });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Gagal memuat data dashboard");
      }
      return response.data;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const summary = data?.summary;
  const stats = useMemo<StatCardConfig[]>(() => {
    const timeframeLabel = buildRangeLabel(summary?.period_start, summary?.period_end);
    const growth = summary?.revenue_growth ?? 0;

    return [
      {
        label: "Total pendapatan",
        value: formatCurrency(summary?.total_revenue ?? 0),
        icon: WalletCards,
        helper: summary
          ? `${formatGrowthValue(growth)} | Periode lalu ${formatCurrency(summary.previous_revenue)}`
          : "Menunggu data",
        iconClassName: "bg-[#eef2fb] text-[#071a4f] dark:bg-[#142454] dark:text-sky-200",
        compactValue: true,
        isDelta: true,
        trendPositive: growth >= 0,
      },
      {
        label: "Transaksi",
        value: (summary?.total_transactions ?? 0).toLocaleString("id-ID"),
        icon: ShoppingCart,
        helper: timeframeLabel,
        iconClassName: "bg-red-50 text-[#e30613] dark:bg-red-950 dark:text-red-300",
      },
      {
        label: "Pelanggan unik",
        value: (summary?.unique_customers ?? 0).toLocaleString("id-ID"),
        icon: Users,
        helper: summary
          ? `${summary.internal_customers.toLocaleString("id-ID")} internal, ${summary.external_customers.toLocaleString("id-ID")} eksternal`
          : "Menunggu data",
        iconClassName: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
      },
      {
        label: "Pertumbuhan",
        value: `${growth.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
        icon: TrendingUp,
        helper: formatGrowthLabel(growth),
        iconClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        isDelta: true,
        trendPositive: growth >= 0,
      },
    ];
  }, [summary]);

  const revenueTrend = data?.revenue_trend ?? [];
  const categoryDistribution = data?.category_distribution ?? [];
  const recentTransactions = data?.recent_transactions ?? [];

  return (
    <AppLayout title="Dashboard">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span className="text-foreground">Ringkasan</span>
            </nav>
            <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">Ringkasan bisnis</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pantau performa commerce dan aktivitas transaksi terbaru.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}>
              <SelectTrigger className="h-9 w-[155px] rounded-lg bg-card" aria-label="Pilih periode dashboard">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days} hari terakhir
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg bg-card"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Muat ulang data dashboard"
              title="Muat ulang data"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {isLoading ? (
          <DashboardContentSkeleton />
        ) : isError ? (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-border bg-card px-6 text-center" role="alert">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <CircleAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">Data dashboard belum dapat dimuat</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {error?.message || "Terjadi kendala saat mengambil analytics. Silakan coba kembali."}
            </p>
            <Button type="button" variant="outline" className="mt-5 rounded-lg" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Coba lagi
            </Button>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Metrik utama">
              {stats.map((stat) => {
                const TrendIcon = stat.trendPositive ? ArrowUpRight : ArrowDownRight;

                return (
                  <article key={stat.label} className="min-h-32 rounded-lg border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/20 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <p className="pt-0.5 text-xs font-bold text-muted-foreground">{stat.label}</p>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}>
                        <stat.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                    <p className={`mt-1 font-extrabold text-foreground ${stat.compactValue ? "text-xl" : "text-2xl"}`}>
                      {stat.value}
                    </p>
                    <div className="mt-2 flex min-w-0 items-start gap-1">
                      {stat.isDelta && (
                        <TrendIcon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${stat.trendPositive ? "text-emerald-600" : "text-destructive"}`}
                          aria-hidden="true"
                        />
                      )}
                      <p
                        className={`line-clamp-2 text-xs leading-4 ${
                          stat.isDelta
                            ? stat.trendPositive
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {stat.helper}
                      </p>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" aria-label="Visualisasi analytics">
              <article className="rounded-lg border border-border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Tren pendapatan</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Performa pendapatan pada periode terpilih</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>

                {revenueTrend.length > 0 ? (
                  <div className="h-[285px] w-full" aria-label="Grafik tren pendapatan">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${(value / 1_000_000).toFixed(0)} jt`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--popover-foreground))",
                            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
                          }}
                          formatter={(value: number) => [formatCurrency(value), "Pendapatan"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#071a4f"
                          fill="rgba(7, 26, 79, 0.12)"
                          strokeWidth={2.5}
                          activeDot={{ r: 4, fill: "#e30613" }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[285px] items-center justify-center text-center">
                    <div>
                      <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-foreground">Belum ada data pendapatan</p>
                      <p className="mt-1 text-xs text-muted-foreground">Data akan tampil ketika transaksi tersedia.</p>
                    </div>
                  </div>
                )}
              </article>

              <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Kategori teratas</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Kontribusi terhadap transaksi</p>
                </div>

                {categoryDistribution.length > 0 ? (
                  <>
                    <div className="h-[220px] w-full" aria-label="Diagram distribusi kategori">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={56}
                            outerRadius={82}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="transparent"
                            isAnimationActive={false}
                          >
                            {categoryDistribution.map((category, index) => (
                              <Cell key={category.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${value.toFixed(1)}%`, "Kontribusi"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              color: "hsl(var(--popover-foreground))",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2.5">
                      {categoryDistribution.slice(0, 5).map((category, index) => (
                        <div key={category.name} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">{category.name}</span>
                          <span className="font-medium text-foreground">{category.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[290px] items-center justify-center text-center">
                    <div>
                      <ReceiptText className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-foreground">Belum ada kategori</p>
                      <p className="mt-1 text-xs text-muted-foreground">Distribusi kategori belum tersedia.</p>
                    </div>
                  </div>
                )}
              </article>
            </section>

            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-labelledby="recent-transactions-title">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div>
                  <h3 id="recent-transactions-title" className="text-sm font-semibold text-foreground">Transaksi terbaru</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Aktivitas terbaru dari seluruh store</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-lg" asChild>
                  <Link to="/transactions">
                    Lihat semua
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-5 py-3 text-left text-xs font-bold text-foreground">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-foreground">Pelanggan</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-foreground">Store</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-foreground">Waktu</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-foreground">Total</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center">
                          <ReceiptText className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                          <p className="mt-2 text-sm font-medium text-foreground">Belum ada transaksi</p>
                          <p className="mt-1 text-xs text-muted-foreground">Transaksi pada periode ini akan tampil di sini.</p>
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/35">
                          <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">{transaction.invoice_number}</td>
                          <td className="max-w-48 truncate px-4 py-3.5 text-muted-foreground">{transaction.customer_name}</td>
                          <td className="max-w-44 truncate px-4 py-3.5 text-muted-foreground">{transaction.store_name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">{formatDateTime(transaction.created_at)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-foreground">{formatCurrency(transaction.total)}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-center">
                            <StatusBadge status={normalizeBadgeStatus(transaction.status)} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
