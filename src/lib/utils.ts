import { StatusBadge } from "@/components/shared/StatusBadge";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const calculateFinalPrice = (stock: {
  base_price: number;
  discount_price: number;
  tax_percentage: number;
}) => {
  const basePrice = stock.base_price;
  const discountPrice = stock.discount_price || 0;
  const taxPercentage = stock.tax_percentage || 0;
  const price = discountPrice > 0 ? discountPrice : basePrice;
  const tax = price * (taxPercentage / 100);
  return Math.round(price + tax);
};

export const badgeOderStatus = (status: string) => {
  switch (status) {
    case "REJECTED":
      return "DIBATALKAN";
    case "PAID":
      return "PAID";
    case "READY_TO_PICKUP":
      return "SIAP DIAMBIL";
    case "PREPARING_PRODUCT":
      return "DISIAPKAN";
    case "COMPLETED":
      return "SELESAI";
    case "WAITING_TO_PAYMENT":
      return "MENUNGGU PEMBAYARAN";
    default:
      return status;
  }
};

export const parseIDR = (value) => {
  if (!value) return 0;

  return Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
  );
};


export const getStatusBadgeKey = (status: string) => {
  const map: Record<string, Parameters<typeof StatusBadge>[0]["status"]> = {
    WAITING_TO_PAYMENT: "waiting_payment",
    PAID: "paid",
    PREPARING_PRODUCT: "preparing_product",
    READY_TO_PICKUP: "ready_to_pickup",
    COMPLETED: "completed",
    REJECTED: "inactive",
  };
  return map[status] || "inactive";
};