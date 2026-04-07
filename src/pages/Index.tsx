import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, revenueData, mockTransactions, categoryData } from "@/lib/mockData";
import { TrendingUp, Users, ShoppingCart, DollarSign, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const stats = [
  { label: "Total Revenue", value: 145600000, prefix: "Rp ", icon: DollarSign, change: "+12.5%", color: "text-success" },
  { label: "Transactions", value: 491, icon: ShoppingCart, change: "+8.2%", color: "text-primary" },
  { label: "Customers", value: 156, icon: Users, change: "+5.1%", color: "text-accent-foreground" },
  { label: "Growth", value: 23.5, suffix: "%", icon: TrendingUp, change: "+2.3%", color: "text-success", decimals: 1 },
];

const COLORS = ["hsl(234, 85%, 60%)", "hsl(142, 72%, 40%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(280, 65%, 55%)"];

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <GlassCard key={stat.label} hover delay={i * 0.08}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  <AnimatedCounter
                    end={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight className="h-3 w-3 text-success" />
                  <span className="text-xs text-success font-medium">{stat.change}</span>
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
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(234, 85%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(234, 85%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" opacity={0.5} />
              <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
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
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {categoryData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                {cat.name}
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
              {mockTransactions.map((tx, i) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-2 font-medium text-foreground">{tx.invoice_number}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{tx.customer_name}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{tx.koperasi_name}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{formatCurrency(tx.total)}</td>
                  <td className="py-3 px-2 text-center"><StatusBadge status={tx.status} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppLayout>
  );
}
