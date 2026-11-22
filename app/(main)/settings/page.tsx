import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { youTubeSearchConfigured } from "@/lib/youtube-search";

/** Supabase free plan file storage. */
const FREE_STORAGE_BYTES = 1024 ** 3;

export default function SettingsPage() {
  return (
    <section className="max-w-3xl">
      <h1 className="font-serif text-4xl">Settings</h1>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-muted/60" />}>
        <SettingsContent />
      </Suspense>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-serif text-2xl">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-2xl font-medium tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

async function SettingsContent() {
  const supabase = await createClient();
  const count = (table: "journal_entries" | "music_tracks" | "lyric_lines") =>
    supabase.from(table).select("*", { count: "exact", head: true });

  const [{ data: claims }, entries, tracks, lyrics, { data: media }] = await Promise.all([
    supabase.auth.getClaims(),
    count("journal_entries"),
    count("music_tracks"),
    count("lyric_lines"),
    supabase.from("media_assets").select("media_type, file_size"),
  ]);

  const email = (claims?.claims.email as string | undefined) ?? "";
  const photos = (media ?? []).filter((m) => m.media_type === "IMAGE").length;
  const videos = (media ?? []).filter((m) => m.media_type === "VIDEO").length;
  const mediaBytes = (media ?? []).reduce((sum, m) => sum + Number(m.file_size), 0);
  const usedShare = Math.min(1, mediaBytes / FREE_STORAGE_BYTES);
  const youtube = youTubeSearchConfigured();

  return (
    <div className="mt-8 flex flex-col gap-6">
      <Card title="Account">
        <dl className="grid gap-1 text-sm">
          <dt className="text-muted-foreground">Signed in as</dt>
          <dd className="font-medium">{email || "Unknown"}</dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/auth/update-password">
              <KeyRound /> Change password
            </Link>
          </Button>
          <LogoutButton />
        </div>
      </Card>

      <Card title="Your journal">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Memories" value={entries.count ?? 0} />
          <Stat label="Photos" value={photos} />
          <Stat label="Videos" value={videos} />
          <Stat label="Songs" value={tracks.count ?? 0} />
          <Stat label="Lyric lines" value={lyrics.count ?? 0} />
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-sm">
            <span>Photos &amp; videos storage</span>
            <span className="tabular-nums text-muted-foreground">
              {formatBytes(mediaBytes)} of {formatBytes(FREE_STORAGE_BYTES)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={usedShare > 0.85 ? "h-full bg-destructive" : "h-full bg-jaffa"}
              style={{ width: `${Math.max(usedShare * 100, mediaBytes ? 1 : 0)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Based on the Supabase free plan (1 GB). Uploaded songs also count toward this but aren&apos;t included here.
          </p>
        </div>
      </Card>

      <Card title="Music & lyrics">
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-2">
            {youtube ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-jaffa" />
            )}
            <span>
              <b>YouTube song search</b>{" "}
              {youtube
                ? "is on. About 100 searches a day are free; results are cached for a few hours."
                : "is off. Add YOUTUBE_API_KEY to the environment to turn it on. Pasting YouTube links still works."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            <span>
              <b>Synced lyrics</b> come from LRCLIB, a free community database (not officially licensed). Imported lyrics
              are always loaded for review before you save them.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
