import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { formatEntryDate, type Entry } from "@/lib/journal";

const bands = ["bg-butter", "bg-rose", "bg-apricot", "bg-mercury"];

export function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <Link
      href={`/journal/${entry.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`h-2 ${bands[index % bands.length]}`} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
          <span>{formatEntryDate(entry.entry_date, "short")}</span>
          {entry.is_favorite && (
            <Star className="h-4 w-4 fill-jaffa text-jaffa" aria-label="Favorite" />
          )}
        </div>
        <h2 className="font-serif text-xl leading-snug group-hover:underline">
          {entry.title}
        </h2>
        {entry.location && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {entry.location}
          </p>
        )}
        {entry.body && (
          <p className="line-clamp-3 text-sm text-foreground/80">{entry.body}</p>
        )}
        {entry.mood && (
          <span className="mt-auto w-fit rounded-full bg-rose/30 px-2.5 py-0.5 text-xs">
            {entry.mood}
          </span>
        )}
      </div>
    </Link>
  );
}

export function EntryGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/60" />
      ))}
    </div>
  );
}

export function EntryGrid({ entries }: { entries: Entry[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e, i) => (
        <EntryCard key={e.id} entry={e} index={i} />
      ))}
    </div>
  );
}
