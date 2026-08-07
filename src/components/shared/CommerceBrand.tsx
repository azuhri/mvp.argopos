import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CommerceBrandProps {
  compact?: boolean;
  className?: string;
  to?: string;
  ariaLabel?: string;
  subtitle?: string;
}

const brandAsset = `${import.meta.env.BASE_URL}image/amp-mart-icon.png`;

export function CommerceBrand({
  compact = false,
  className,
  to = "/commerce",
  ariaLabel = "AMP Mart, kembali ke katalog",
  subtitle = "Argo Manunggal Proteindo",
}: CommerceBrandProps) {
  return (
    <Link
      to={to}
      className={cn("flex min-w-0 items-center gap-3", className)}
      aria-label={ariaLabel}
    >
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
        <img
          src={brandAsset}
          alt=""
          className="absolute left-[-44px] top-[-20px] h-[132px] w-[132px] max-w-none"
        />
      </span>

      {!compact && (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-lg font-extrabold text-[#071a4f] dark:text-slate-100">
            AMP <span className="text-[#e30613]">Mart</span>
          </span>
          <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {subtitle}
          </span>
        </span>
      )}
    </Link>
  );
}
