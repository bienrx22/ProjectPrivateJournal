export const MEDIA_BUCKET = "journal-media";

/** Matches the bucket's 50 MB limit (Supabase free plan). */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/**
 * Types the bucket accepts AND browsers can display.
 * HEIC is left out on purpose: only Safari can show it.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const ACCEPT_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

export type MediaType = "IMAGE" | "VIDEO";

export function mediaTypeFor(mime: string): MediaType | null {
  if (IMAGE_TYPES.includes(mime)) return "IMAGE";
  if (VIDEO_TYPES.includes(mime)) return "VIDEO";
  return null;
}

/** A media item as the gallery needs it: a short-lived signed URL, never the raw path. */
export type MediaItem = {
  id: string;
  url: string;
  mediaType: MediaType;
  hasTrack: boolean;
};
