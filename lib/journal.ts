import type { Tables } from "@/lib/database.types";

export type Entry = Tables<"journal_entries">;

export const MOODS = [
  "Happy",
  "Grateful",
  "Calm",
  "Loved",
  "Excited",
  "Nostalgic",
  "Reflective",
  "Sad",
];

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** entry_date is a plain date ("2026-11-22"); format it without a timezone shift. */
export function formatEntryDate(date: string, style: "long" | "short" = "long") {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  });
}
