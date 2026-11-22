import Link from "next/link";
import { Mic2, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Music | Lyrics" switcher for a media item. Lyrics need a saved track first. */
export function MusicTabs({
  entryId,
  mediaId,
  active,
  hasTrack,
}: {
  entryId: string;
  mediaId: string;
  active: "music" | "lyrics";
  hasTrack: boolean;
}) {
  const base = `/journal/${entryId}/media/${mediaId}`;
  const tab = "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition";
  return (
    <nav className="inline-flex gap-1 rounded-xl bg-muted p-1" aria-label="Music and lyrics">
      <Link
        href={`${base}/music`}
        aria-current={active === "music" ? "page" : undefined}
        className={cn(tab, active === "music" ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
      >
        <Music2 className="h-4 w-4" /> Music
      </Link>
      {hasTrack ? (
        <Link
          href={`${base}/lyrics`}
          aria-current={active === "lyrics" ? "page" : undefined}
          className={cn(tab, active === "lyrics" ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <Mic2 className="h-4 w-4" /> Lyrics
        </Link>
      ) : (
        <span className={cn(tab, "cursor-not-allowed text-muted-foreground/50")} title="Save music first">
          <Mic2 className="h-4 w-4" /> Lyrics
        </span>
      )}
    </nav>
  );
}
