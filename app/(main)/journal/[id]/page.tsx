import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import { MediaGrid } from "@/components/journal/media-grid";
import { MediaUploader } from "@/components/journal/media-uploader";
import { MEDIA_BUCKET, type MediaItem } from "@/lib/media";
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
          <EntryMedia entryId={entry.id} />
        </Suspense>
      </section>
    </>
  );
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function EntryMedia({ entryId }: { entryId: string }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const { data: rows, error } = await supabase
    .from("media_assets")
    .select("id, file_path, media_type, music_tracks(id)")
    .eq("entry_id", entryId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  let items: MediaItem[] = [];
  if (rows.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(rows.map((r) => r.file_path), SIGNED_URL_TTL_SECONDS);
    if (signError) throw new Error(signError.message);
    const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    items = rows.flatMap((r) => {
      const url = urlByPath.get(r.file_path);
      const track = r.music_tracks as unknown;
      const hasTrack = Array.isArray(track) ? track.length > 0 : Boolean(track);
      return url ? [{ id: r.id, url, mediaType: r.media_type as MediaItem["mediaType"], hasTrack }] : [];
    });
  }

  return (
    <>
      {items.length > 0 && <MediaGrid entryId={entryId} items={items} />}
      <MediaUploader entryId={entryId} userId={userId} />
    </>
  );
}
