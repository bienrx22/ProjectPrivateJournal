import Link from "next/link";
import { Images, MapPin, Play, Star } from "lucide-react";
import { formatEntryDate } from "@/lib/journal";
import type { EntryWithCover } from "@/lib/entries";

const bands = ["bg-butter", "bg-rose", "bg-apricot", "bg-mercury"];

export function EntryCard({ entry, index }: { entry: EntryWithCover; index: number }) {
  return (
    <Link
      href={`/journal/${entry.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {entry.cover ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {entry.cover.mediaType === "IMAGE" ? (
            // Signed URLs change per request, so the Next image optimizer adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.cover.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <>
              <video
                src={`${entry.cover.url}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                tabIndex={-1}
                className="pointer-events-none h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                <Play className="h-3.5 w-3.5 fill-white" />
              </span>
            </>
          )}
          {entry.mediaCount > 1 && (
            <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur">
              <Images className="h-3.5 w-3.5" /> {entry.mediaCount}
            </span>
          )}
        </div>
      ) : (
        <div className={`h-2 ${bands[index % bands.length]}`} />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
          <span>{formatEntryDate(entry.entry_date, "short")}</span>
          {entry.is_favorite && <Star className="h-4 w-4 fill-jaffa text-jaffa" aria-label="Favorite" />}
        </div>
        <h2 className="font-serif text-xl leading-snug group-hover:underline">{entry.title}</h2>
        {entry.location && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {entry.location}
          </p>
        )}
        {entry.body && <p className="line-clamp-3 text-sm text-foreground/80">{entry.body}</p>}
        {entry.mood && (
          <span className="mt-auto w-fit rounded-full bg-rose/30 px-2.5 py-0.5 text-xs">{entry.mood}</span>
        )}
      </div>
    </Link>
  );
}

export function EntryGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-xl border bg-muted/60" />
      ))}
    </div>
  );
}

export function EntryGrid({ entries }: { entries: EntryWithCover[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e, i) => (
        <EntryCard key={e.id} entry={e} index={i} />
      ))}
    </div>
  );
}
