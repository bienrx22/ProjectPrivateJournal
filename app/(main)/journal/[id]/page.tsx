import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/journal/favorite-button";
import { DeleteEntryButton } from "@/components/journal/delete-entry-button";
import { deleteEntry } from "@/app/(main)/journal/actions";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, formatEntryDate } from "@/lib/journal";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
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
    <article className="mx-auto max-w-3xl">
      <Link
        href="/journal"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All memories
      </Link>

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
            <DeleteEntryButton action={deleteEntry.bind(null, entry.id)} />
          </div>
        </div>
      </header>

      {entry.body ? (
        <p className="mt-8 whitespace-pre-wrap text-lg leading-relaxed">{entry.body}</p>
      ) : (
        <p className="mt-8 italic text-muted-foreground">No description.</p>
      )}

      <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <ImageIcon className="h-6 w-6" />
        Photos and videos for this memory will appear here.
      </div>
    </article>
  );
}
