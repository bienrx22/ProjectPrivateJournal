import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MusicEditor } from "@/components/music/music-editor";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";
import { MEDIA_BUCKET } from "@/lib/media";
import { AUDIO_BUCKET, DEFAULT_SEGMENT_MS } from "@/lib/music";

type Params = Promise<{ id: string; mediaId: string }>;

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default function MusicPage({ params }: { params: Params }) {
  return (
    <section>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/60" />}>
        <MusicPageContent params={params} />
      </Suspense>
    </section>
  );
}

async function MusicPageContent({ params }: { params: Params }) {
  const { id, mediaId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mediaId)) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub as string;

  const [{ data: media }, { data: entry }, { data: track }] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, entry_id, file_path, media_type, duration_ms")
      .eq("id", mediaId)
      .eq("entry_id", id)
      .maybeSingle(),
    supabase.from("journal_entries").select("title").eq("id", id).maybeSingle(),
    supabase.from("music_tracks").select("*").eq("media_asset_id", mediaId).maybeSingle(),
  ]);
  if (!media || !entry) notFound();

  const [{ data: mediaUrl }, audio] = await Promise.all([
    supabase.storage.from(MEDIA_BUCKET).createSignedUrl(media.file_path, SIGNED_URL_TTL_SECONDS),
    track?.source === "upload" && track.storage_path
      ? supabase.storage.from(AUDIO_BUCKET).createSignedUrl(track.storage_path, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve({ data: null }),
  ]);

  const isVideo = media.media_type === "VIDEO";
  const defaultLengthMs = isVideo && media.duration_ms ? media.duration_ms : DEFAULT_SEGMENT_MS;

  return (
    <>
      <Link
        href={`/journal/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {entry.title}
      </Link>
      <h1 className="mt-4 font-serif text-4xl">Music</h1>
      <p className="mt-1 text-muted-foreground">
        Choose the song that plays with this {isVideo ? "video" : "photo"}.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {mediaUrl?.signedUrl &&
              (isVideo ? (
                <video src={`${mediaUrl.signedUrl}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl.signedUrl} alt="" className="h-full w-full object-cover" />
              ))}
          </div>
          {isVideo && media.duration_ms && (
            <p className="mt-2 text-xs text-muted-foreground">
              The video is {Math.round(media.duration_ms / 1000)}s long, so new segments default to that length.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <MusicEditor
            entryId={id}
            mediaId={mediaId}
            userId={userId}
            track={track}
            savedAudioUrl={audio.data?.signedUrl ?? null}
            defaultLengthMs={defaultLengthMs}
          />
        </div>
      </div>
    </>
  );
}
