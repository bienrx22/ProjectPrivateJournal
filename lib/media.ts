import type { LyricLine } from "@/lib/lyrics";
import type { Track } from "@/lib/music";

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
  track: ViewerTrack | null;
};

/** What the viewer needs to play a media item's song. */
export type ViewerTrack = {
  source: "upload" | "youtube";
  audioUrl: string | null; // signed URL, uploads only
  youtubeVideoId: string | null;
  /** YouTube channel profile photo, when known. */
  artworkUrl: string | null;
  title: string;
  artist: string | null;
  startMs: number;
  endMs: number | null;
  volume: number;
  /** Segment-relative, sorted by time. */
  lyrics: LyricLine[];
  lyricsOffsetMs: number;
};

type TrackRow = Track & { lyric_lines?: { text: string; start_ms: number; sort_order: number }[] | null };

/** DB row (+ optional embedded lyric_lines) → what the player/viewer needs. */
export function toViewerTrack(t: TrackRow, audioUrl: string | null): ViewerTrack {
  return {
    source: t.source as ViewerTrack["source"],
    audioUrl,
    youtubeVideoId: t.youtube_video_id,
    artworkUrl: t.artwork_url,
    title: t.title,
    artist: t.artist,
    startMs: t.start_ms,
    endMs: t.end_ms,
    volume: Number(t.volume),
    lyrics: (t.lyric_lines ?? [])
      .map((l) => ({ text: l.text, startMs: l.start_ms }))
      .sort((a, b) => a.startMs - b.startMs),
    lyricsOffsetMs: t.lyrics_offset_ms,
  };
}

/** Shown at the top of the viewer. */
export type MediaCaption = { location: string | null; date: string };
