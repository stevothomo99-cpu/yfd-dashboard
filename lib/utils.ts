import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function fmtCurrency(value: number): string {
  return AUD.format(value);
}

export function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "m";
  }
  if (Math.abs(value) >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "k";
  }
  return "$" + value.toFixed(0);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fyYearFor(date: Date): number {
  const m = date.getMonth();
  const y = date.getFullYear();
  return m >= 6 ? y + 1 : y;
}

export function fyLabel(fyYear: number): string {
  return "FY" + String(fyYear).slice(-2);
}

export function fyRange(fyYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(fyYear - 1, 6, 1)),
    end: new Date(Date.UTC(fyYear, 5, 30, 23, 59, 59)),
  };
}
