"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAX_MEDIA_BYTES, MEDIA_BUCKET, mediaTypeFor } from "@/lib/media";
import { UUID_RE } from "@/lib/journal";

export type MediaActionResult = { error?: string };

async function authed() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");
  return { supabase, userId: data.claims.sub as string };
}

type NewMedia = {
  path: string;
  mimeType: string;
  size: number;
  durationMs: number | null;
};

/** Records a file the browser already uploaded to journal-media/{user}/{entry}/. */
export async function addMedia(entryId: string, item: NewMedia): Promise<MediaActionResult> {
  const { supabase, userId } = await authed();

  const mediaType = mediaTypeFor(item.mimeType);
  const validPath =
    UUID_RE.test(entryId) &&
    item.path.startsWith(`${userId}/${entryId}/`) &&
    !item.path.includes("..");
  if (!validPath || !mediaType || item.size <= 0 || item.size > MAX_MEDIA_BYTES) {
    return { error: "Invalid upload." };
  }

  const { data: last } = await supabase
    .from("media_assets")
    .select("sort_order")
    .eq("entry_id", entryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("media_assets").insert({
    entry_id: entryId,
    file_path: item.path,
    media_type: mediaType,
    mime_type: item.mimeType,
    file_size: item.size,
    duration_ms: item.durationMs,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) {
    // Don't leave an orphaned file behind if the row couldn't be saved.
    await supabase.storage.from(MEDIA_BUCKET).remove([item.path]);
    return { error: error.message };
  }

  revalidatePath(`/journal/${entryId}`);
  return {};
}

export async function deleteMedia(mediaId: string): Promise<MediaActionResult> {
  const { supabase } = await authed();

  const { data: media, error } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", mediaId)
    .select("entry_id, file_path, thumbnail_path")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!media) return { error: "Not found." };

  const paths = [media.file_path, media.thumbnail_path].filter((p): p is string => Boolean(p));
  await supabase.storage.from(MEDIA_BUCKET).remove(paths);

  revalidatePath(`/journal/${media.entry_id}`);
  return {};
}

export async function setMediaOrder(entryId: string, orderedIds: string[]): Promise<MediaActionResult> {
  const { supabase } = await authed();
  if (!UUID_RE.test(entryId) || !orderedIds.every((id) => UUID_RE.test(id))) {
    return { error: "Invalid order." };
  }

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("media_assets").update({ sort_order: index }).eq("id", id).eq("entry_id", entryId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/journal/${entryId}`);
  return {};
}
