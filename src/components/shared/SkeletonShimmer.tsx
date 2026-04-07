import { cn } from "@/lib/utils";

interface SkeletonShimmerProps {
  className?: string;
  lines?: number;
}

export function SkeletonShimmer({ className, lines = 3 }: SkeletonShimmerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-muted shimmer"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card p-6 space-y-4", className)}>
      <div className="h-4 w-1/3 rounded bg-muted shimmer" />
      <div className="h-8 w-2/3 rounded bg-muted shimmer" />
      <div className="h-3 w-1/2 rounded bg-muted shimmer" />
    </div>
  );
}
