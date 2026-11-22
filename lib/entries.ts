import type { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type MediaType } from "@/lib/media";
import type { Entry } from "@/lib/journal";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type EntryCover = { url: string; mediaType: MediaType };
export type EntryWithCover = Entry & { cover: EntryCover | null; mediaCount: number };

/** Select for journal_entries that also brings each entry's media paths (for the cover). */
export const ENTRY_WITH_MEDIA_SELECT = "*, media_assets(file_path, media_type, sort_order, created_at)";

type MediaRef = { file_path: string; media_type: string; sort_order: number; created_at: string };

/** Picks each entry's first photo/video and signs its URL (one batch call for the whole list). */
export async function withCovers(
  supabase: Supabase,
  rows: (Entry & { media_assets: MediaRef[] | null })[],
): Promise<EntryWithCover[]> {
  const firsts = rows.map((r) => {
    const media = [...(r.media_assets ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    return { media: media[0] ?? null, count: media.length };
  });

  const paths = firsts.flatMap((f) => (f.media ? [f.media.file_path] : []));
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return rows.map((r, i) => {
    // Drop the embedded media list; cards only need the cover.
    const { media_assets: _media, ...entry } = r;
    void _media;
    const first = firsts[i].media;
    const url = first ? urlByPath.get(first.file_path) : undefined;
    return {
      ...entry,
      cover: first && url ? { url, mediaType: first.media_type as MediaType } : null,
      mediaCount: firsts[i].count,
    };
  });
}
