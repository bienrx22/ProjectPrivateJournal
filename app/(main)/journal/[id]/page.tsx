import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import { MediaGrid } from "@/components/journal/media-grid";
import { MediaUploader } from "@/components/journal/media-uploader";
import { MEDIA_BUCKET, toViewerTrack, type MediaCaption, type MediaItem } from "@/lib/media";
import { AUDIO_BUCKET, type Track } from "@/lib/music";
import { channelAvatarOrNull } from "@/lib/youtube-search";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/journal/favorite-button";
import { DeleteEntryButton } from "@/components/journal/delete-entry-button";
import { deleteEntry } from "@/app/(main)/journal/actions";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, formatEntryDate } from "@/lib/journal";

type Params = Promise<{ id: string }>;

export default function EntryPage({ params }: { params: Params }) {
  return (
    <article className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Memories
      </Link>
      <Suspense fallback={<EntrySkeleton />}>
        <EntryDetail params={params} />
      </Suspense>
    </article>
  );
}

function EntrySkeleton() {
  return (
    <div className="mt-6 flex animate-pulse flex-col gap-4" aria-busy="true">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-12 w-3/4 rounded bg-muted" />
      <div className="h-24 rounded bg-muted/60" />
    </div>
  );
}

async function EntryDetail({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!entry) notFound();

  return (
    <>
      <header className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-wide text-muted-foreground">
          <time dateTime={entry.entry_date}>{formatEntryDate(entry.entry_date)}</time>
          {entry.mood && (
            <span className="rounded-full bg-rose/30 px-2.5 py-0.5 text-xs normal-case tracking-normal text-foreground">
              {entry.mood}
            </span>
          )}
        </div>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{entry.title}</h1>
        {entry.location && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {entry.location}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1 border-y py-2">
          <FavoriteButton id={entry.id} isFavorite={entry.is_favorite} />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/journal/${entry.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <div className="ml-auto">
            <DeleteEntryButton action={deleteEntry.bind(null, entry.id)} title={entry.title} />
          </div>
        </div>
      </header>

      {entry.body ? (
        <p className="mt-8 whitespace-pre-wrap text-lg leading-relaxed">{entry.body}</p>
      ) : (
        <p className="mt-8 italic text-muted-foreground">No description.</p>
      )}

      <section className="mt-10 flex flex-col gap-4" aria-label="Photos and videos">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/60" />}>
          <EntryMedia
            entryId={entry.id}
            caption={{ location: entry.location, date: formatEntryDate(entry.entry_date) }}
          />
        </Suspense>
      </section>
    </>
  );
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function EntryMedia({ entryId, caption }: { entryId: string; caption: MediaCaption }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data: rows, error } = await supabase
    .from("media_assets")
    .select("id, file_path, media_type, music_tracks(*, lyric_lines(text, start_ms, sort_order))")
    .eq("entry_id", entryId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  // The embed can come back as an object or a one-item array.
  type TrackWithLyrics = Track & { lyric_lines: { text: string; start_ms: number; sort_order: number }[] };
  const trackOf = (r: (typeof rows)[number]): TrackWithLyrics | null => {
    const t = r.music_tracks as unknown as TrackWithLyrics | TrackWithLyrics[] | null;
    return (Array.isArray(t) ? t[0] : t) ?? null;
  };

  // One-time backfill: YouTube tracks saved before artwork existed get their channel photo now.
  const missingArtwork = rows
    .map(trackOf)
    .filter((t): t is TrackWithLyrics => t?.source === "youtube" && !t.artwork_url && Boolean(t.youtube_video_id));
  await Promise.all(
    missingArtwork.map(async (t) => {
      const url = await channelAvatarOrNull(t.youtube_video_id!);
      if (!url) return;
      t.artwork_url = url;
      await supabase.from("music_tracks").update({ artwork_url: url }).eq("id", t.id);
    }),
  );

  let items: MediaItem[] = [];
  if (rows.length) {
    const audioPaths = rows.flatMap((r) => {
      const t = trackOf(r);
      return t?.source === "upload" && t.storage_path ? [t.storage_path] : [];
    });

    const [mediaSigned, audioSigned] = await Promise.all([
      supabase.storage.from(MEDIA_BUCKET).createSignedUrls(rows.map((r) => r.file_path), SIGNED_URL_TTL_SECONDS),
      audioPaths.length
        ? supabase.storage.from(AUDIO_BUCKET).createSignedUrls(audioPaths, SIGNED_URL_TTL_SECONDS)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (mediaSigned.error) throw new Error(mediaSigned.error.message);
    const urlByPath = new Map(mediaSigned.data.map((s) => [s.path, s.signedUrl]));
    const audioByPath = new Map((audioSigned.data ?? []).map((s) => [s.path, s.signedUrl]));

    items = rows.flatMap((r) => {
      const url = urlByPath.get(r.file_path);
      if (!url) return [];
      const t = trackOf(r);
      const track = t
        ? toViewerTrack(t, t.storage_path ? (audioByPath.get(t.storage_path) ?? null) : null)
        : null;
      return [{ id: r.id, url, mediaType: r.media_type as MediaItem["mediaType"], track }];
    });
  }

  return (
    <>
      {items.length > 0 && <MediaGrid entryId={entryId} items={items} caption={caption} />}
      <MediaUploader entryId={entryId} userId={userId} />
    </>
  );
}
