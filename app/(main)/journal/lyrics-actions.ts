"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";
import { MAX_LYRIC_LINES, MAX_LYRIC_LINE_LENGTH, MAX_OFFSET_MS, type LyricLine } from "@/lib/lyrics";

async function authed() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");
  return supabase;
}

/** Replaces all lyric lines of a media item's track, and saves the timing offset. */
export async function saveLyrics(
  mediaId: string,
  input: { lines: LyricLine[]; offsetMs: number },
): Promise<{ error?: string }> {
  const supabase = await authed();
  if (!UUID_RE.test(mediaId)) return { error: "Invalid media." };

  const { lines, offsetMs } = input;
  if (lines.length > MAX_LYRIC_LINES) return { error: `Up to ${MAX_LYRIC_LINES} lines.` };
  if (!Number.isInteger(offsetMs) || Math.abs(offsetMs) > MAX_OFFSET_MS) return { error: "Invalid offset." };
  for (const l of lines) {
    if (typeof l.text !== "string" || l.text.length > MAX_LYRIC_LINE_LENGTH) return { error: "A line is too long." };
    if (!Number.isInteger(l.startMs) || l.startMs < 0) return { error: "Every line needs a time." };
  }

  const { data: track } = await supabase
    .from("music_tracks")
    .select("id, media_assets(entry_id)")
    .eq("media_asset_id", mediaId)
    .maybeSingle();
  if (!track) return { error: "Add music to this photo or video first." };

  const { error: deleteError } = await supabase.from("lyric_lines").delete().eq("track_id", track.id);
  if (deleteError) return { error: deleteError.message };

  if (lines.length) {
    const rows = [...lines]
      .sort((a, b) => a.startMs - b.startMs)
      .map((l, i) => ({ track_id: track.id, text: l.text.trim(), start_ms: l.startMs, sort_order: i }));
    const { error } = await supabase.from("lyric_lines").insert(rows);
    if (error) return { error: error.message };
  }

  const { error: offsetError } = await supabase
    .from("music_tracks")
    .update({ lyrics_offset_ms: offsetMs })
    .eq("id", track.id);
  if (offsetError) return { error: offsetError.message };

  const media = track.media_assets as unknown as { entry_id: string } | { entry_id: string }[] | null;
  const entryId = Array.isArray(media) ? media[0]?.entry_id : media?.entry_id;
  if (entryId) revalidatePath(`/journal/${entryId}`, "layout");
  return {};
}

export type LrclibResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  durationSec: number | null;
  synced: string | null;
  plain: string | null;
};

type LrclibRow = {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/**
 * LRCLIB: free, no key, community-sourced (not licensed) synced lyrics.
 * Results are loaded into the editor for review, never saved automatically.
 */
export async function searchLyrics(
  title: string,
  artist: string,
): Promise<{ results?: LrclibResult[]; error?: string }> {
  await authed();
  const trackName = title.trim();
  if (!trackName) return { error: "The song needs a title to search for lyrics." };

  const params = new URLSearchParams({ track_name: trackName });
  if (artist.trim()) params.set("artist_name", artist.trim());

  try {
    const res = await fetch(`https://lrclib.net/api/search?${params}`, {
      // LRCLIB asks clients to identify themselves; keep it generic.
      headers: { "User-Agent": "PrivateMemoryJournal/0.1 (personal lyrics lookup)" },
    });
    if (!res.ok) return { error: `Lyrics search failed (${res.status}).` };
    const rows = (await res.json()) as LrclibRow[];
    const results = rows
      .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
      .sort((a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        trackName: r.trackName,
        artistName: r.artistName,
        albumName: r.albumName ?? null,
        durationSec: r.duration ?? null,
        synced: r.syncedLyrics ?? null,
        plain: r.plainLyrics ?? null,
      }));
    return { results };
  } catch {
    return { error: "Couldn't reach the lyrics service. Try again in a moment." };
  }
}
