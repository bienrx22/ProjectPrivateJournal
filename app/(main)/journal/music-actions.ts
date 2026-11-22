"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";
import { AUDIO_BUCKET } from "@/lib/music";
import { YOUTUBE_ID_RE } from "@/lib/youtube";
import {
  channelAvatarOrNull,
  searchSongs,
  youTubeSearchConfigured,
  type SongResult,
} from "@/lib/youtube-search";

export type MusicActionResult = { error?: string };

export type TrackInput = {
  source: "upload" | "youtube";
  storagePath: string | null;
  youtubeVideoId: string | null;
  title: string;
  artist: string;
  startMs: number;
  endMs: number | null;
  volume: number;
};

async function authed() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");
  return { supabase, userId: data.claims.sub as string };
}

function validate(input: TrackInput, userId: string, mediaId: string): string | null {
  const title = input.title.trim();
  if (!title) return "Give the song a title.";
  if (title.length > 200 || input.artist.trim().length > 200) return "Title and artist must be 200 characters or fewer.";
  if (!Number.isInteger(input.startMs) || input.startMs < 0) return "Invalid start time.";
  if (input.endMs != null && (!Number.isInteger(input.endMs) || input.endMs <= input.startMs)) {
    return "The end must be after the start.";
  }
  if (!(input.volume >= 0 && input.volume <= 1)) return "Invalid volume.";

  if (input.source === "upload") {
    const path = input.storagePath ?? "";
    if (!path.startsWith(`${userId}/${mediaId}/`) || path.includes("..")) return "Invalid audio file.";
  } else if (input.source === "youtube") {
    if (!YOUTUBE_ID_RE.test(input.youtubeVideoId ?? "")) return "Invalid YouTube video.";
  } else {
    return "Invalid source.";
  }
  return null;
}

export async function saveTrack(mediaId: string, input: TrackInput): Promise<MusicActionResult> {
  const { supabase, userId } = await authed();
  if (!UUID_RE.test(mediaId)) return { error: "Invalid media." };

  const invalid = validate(input, userId, mediaId);
  if (invalid) return { error: invalid };

  const { data: media } = await supabase
    .from("media_assets")
    .select("id, entry_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return { error: "This photo or video no longer exists." };

  const { data: previous } = await supabase
    .from("music_tracks")
    .select("storage_path, youtube_video_id, artwork_url")
    .eq("media_asset_id", mediaId)
    .maybeSingle();

  const isUpload = input.source === "upload";

  // YouTube: the channel's profile photo goes on the music icon. Reuse it if the video didn't change.
  let artworkUrl: string | null = null;
  if (!isUpload && input.youtubeVideoId) {
    artworkUrl =
      previous?.youtube_video_id === input.youtubeVideoId && previous.artwork_url
        ? previous.artwork_url
        : await channelAvatarOrNull(input.youtubeVideoId);
  }

  const { error } = await supabase.from("music_tracks").upsert(
    {
      media_asset_id: mediaId,
      source: input.source,
      storage_path: isUpload ? input.storagePath : null,
      youtube_video_id: isUpload ? null : input.youtubeVideoId,
      title: input.title.trim(),
      artist: input.artist.trim() || null,
      start_ms: input.startMs,
      end_ms: input.endMs,
      volume: Math.round(input.volume * 100) / 100,
      artwork_url: artworkUrl,
    },
    { onConflict: "media_asset_id" },
  );
  if (error) return { error: error.message };

  // The song was replaced (new file, or switched to YouTube): drop the old audio file.
  const newPath = isUpload ? input.storagePath : null;
  if (previous?.storage_path && previous.storage_path !== newPath) {
    await supabase.storage.from(AUDIO_BUCKET).remove([previous.storage_path]);
  }

  revalidatePath(`/journal/${media.entry_id}`, "layout");
  return {};
}

export async function findSongs(
  query: string,
): Promise<{ results?: SongResult[]; error?: string }> {
  await authed();
  if (!youTubeSearchConfigured()) {
    return { error: "Song search isn't set up yet: add YOUTUBE_API_KEY to .env.local. You can still paste a YouTube link." };
  }
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 100) return { error: "Type 2–100 characters to search." };

  try {
    return { results: await searchSongs(q.toLowerCase()) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed.";
    if (/quota/i.test(message)) {
      return { error: "Today's YouTube search limit is used up. It resets at midnight Pacific time — paste a link instead for now." };
    }
    return { error: message };
  }
}

export async function deleteTrack(mediaId: string): Promise<MusicActionResult> {
  const { supabase } = await authed();
  if (!UUID_RE.test(mediaId)) return { error: "Invalid media." };

  const { data: track, error } = await supabase
    .from("music_tracks")
    .delete()
    .eq("media_asset_id", mediaId)
    .select("storage_path, media_assets(entry_id)")
    .maybeSingle();
  if (error) return { error: error.message };

  if (track?.storage_path) await supabase.storage.from(AUDIO_BUCKET).remove([track.storage_path]);

  const media = track?.media_assets as { entry_id: string } | { entry_id: string }[] | null | undefined;
  const entryId = Array.isArray(media) ? media[0]?.entry_id : media?.entry_id;
  if (entryId) revalidatePath(`/journal/${entryId}`, "layout");
  return {};
}
