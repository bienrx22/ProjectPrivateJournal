import type { Tables } from "@/lib/database.types";

export type Track = Tables<"music_tracks">;
export type TrackSource = "upload" | "youtube";

export const AUDIO_BUCKET = "journal-audio";
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/** Must match the journal-audio bucket's allowed_mime_types. */
export const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
];

/** Segment length when nothing better is known (photos). Videos use their own length. */
export const DEFAULT_SEGMENT_MS = 30_000;

/** 83_450 → "1:23.4" */
export function formatMs(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "–";
  const totalTenths = Math.round(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** Accepts "1:23.4", "83.4" or "83". Returns milliseconds, or null if unreadable. */
export function parseTime(input: string): number | null {
  const s = input.trim();
  const m = s.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : 0;
  const seconds = Number(m[2]);
  if (!m[1] && seconds >= 6000) return null;
  if (m[1] && seconds >= 60) return null;
  return Math.round((minutes * 60 + seconds) * 1000);
}

export function audioExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "audio";
}

/** "02 - My Song (Live).mp3" → "My Song (Live)" */
export function titleFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{1,3}\s*[-._ ]\s*/, "")
    .replace(/[_]+/g, " ")
    .trim();
}
