import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Deterministic (UTC) formatting so server and client output match. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d) +
    " UTC"
  );
}
