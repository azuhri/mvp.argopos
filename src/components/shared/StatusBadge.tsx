import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "active" | "inactive" | "pending" | "paid" | "hutang" | "approved" | "waiting_payment" | "preparing_product" | "ready_to_pickup" | "completed";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  hutang: { label: "Hutang", className: "bg-destructive/10 text-destructive border-destructive/20" },
  approved: { label: "Approved", className: "bg-primary/10 text-primary border-primary/20" },
  waiting_payment: { label: "Waiting Payment", className: "bg-warning/10 text-warning border-warning/20" },
  preparing_product: { label: "Preparing", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  ready_to_pickup: { label: "Ready to Pickup", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
};

export function StatusBadge({ status }: { status: StatusType }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
