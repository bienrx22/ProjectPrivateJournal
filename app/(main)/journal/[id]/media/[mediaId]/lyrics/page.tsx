import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricsEditor } from "@/components/lyrics/lyrics-editor";
import { MusicTabs } from "@/components/music/music-tabs";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";
import { MEDIA_BUCKET, toViewerTrack } from "@/lib/media";
import { AUDIO_BUCKET } from "@/lib/music";

type Params = Promise<{ id: string; mediaId: string }>;

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default function LyricsPage({ params }: { params: Params }) {
  return (
    <section>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/60" />}>
        <LyricsPageContent params={params} />
      </Suspense>
    </section>
  );
}

async function LyricsPageContent({ params }: { params: Params }) {
  const { id, mediaId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mediaId)) notFound();

  const supabase = await createClient();
  const [{ data: media }, { data: entry }, { data: track }] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, file_path, media_type")
      .eq("id", mediaId)
      .eq("entry_id", id)
      .maybeSingle(),
    supabase.from("journal_entries").select("title").eq("id", id).maybeSingle(),
    supabase
      .from("music_tracks")
      .select("*, lyric_lines(text, start_ms, sort_order)")
      .eq("media_asset_id", mediaId)
      .maybeSingle(),
  ]);
  if (!media || !entry) notFound();

  const [{ data: mediaUrl }, audio] = await Promise.all([
    supabase.storage.from(MEDIA_BUCKET).createSignedUrl(media.file_path, SIGNED_URL_TTL_SECONDS),
    track?.source === "upload" && track.storage_path
      ? supabase.storage.from(AUDIO_BUCKET).createSignedUrl(track.storage_path, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve({ data: null }),
  ]);

  const viewerTrack = track ? toViewerTrack(track, audio.data?.signedUrl ?? null) : null;
  const isVideo = media.media_type === "VIDEO";

  return (
    <>
      <Link
        href={`/journal/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {entry.title}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Lyrics</h1>
          {viewerTrack && (
            <p className="mt-1 text-muted-foreground">
              {viewerTrack.title}
              {viewerTrack.artist ? ` · ${viewerTrack.artist}` : ""}
            </p>
          )}
        </div>
        <MusicTabs entryId={id} mediaId={mediaId} active="lyrics" hasTrack={Boolean(track)} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mx-auto aspect-square w-40 overflow-hidden rounded-xl bg-muted sm:w-56 lg:w-full">
            {mediaUrl?.signedUrl &&
              (isVideo ? (
                <video src={`${mediaUrl.signedUrl}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl.signedUrl} alt="" className="h-full w-full object-cover" />
              ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Times are counted from the start of your song segment, so changing the segment on the Music tab shifts the
            lyrics too.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          {viewerTrack ? (
            <LyricsEditor
              entryId={id}
              mediaId={mediaId}
              track={viewerTrack}
              initialLines={viewerTrack.lyrics}
              initialOffsetMs={viewerTrack.lyricsOffsetMs}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-muted-foreground">Add a song to this {isVideo ? "video" : "photo"} first.</p>
              <Button asChild>
                <Link href={`/journal/${id}/media/${mediaId}/music`}>Go to Music</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
