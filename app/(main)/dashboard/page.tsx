import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryGrid, EntryGridSkeleton } from "@/components/journal/entry-card";
import { createClient } from "@/lib/supabase/server";
import { ENTRY_WITH_MEDIA_SELECT, withCovers } from "@/lib/entries";
import { DATE_RE, formatEntryDate } from "@/lib/journal";

/** from/to come from the calendar's "+N more" links (one day). */
type SearchParams = Promise<{ from?: string; to?: string }>;

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-4xl">Memories</h1>
        <Button asChild>
          <Link href="/journal/new">
            <Plus /> New Memory
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div className="mt-8"><EntryGridSkeleton /></div>}>
        <MemoryList searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

function rangeLabel(from: string, to: string) {
  if (from && from === to) return `on ${formatEntryDate(from)}`;
  if (from && to) return `from ${formatEntryDate(from)} to ${formatEntryDate(to)}`;
  if (from) return `since ${formatEntryDate(from)}`;
  return `until ${formatEntryDate(to)}`;
}

async function MemoryList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = DATE_RE.test(params.from ?? "") ? params.from! : "";
  const to = DATE_RE.test(params.to ?? "") ? params.to! : "";
  const filtering = Boolean(from || to);

  const supabase = await createClient();
  let query = supabase
    .from("journal_entries")
    .select(ENTRY_WITH_MEDIA_SELECT)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const entries = await withCovers(supabase, data);

  if (!filtering && entries.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground">No memories yet.</p>
        <Button asChild variant="outline">
          <Link href="/journal/new">Write your first memory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {filtering && (
        <p className="mb-4 text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "memory" : "memories"} {rangeLabel(from, to)} ·{" "}
          <Link href="/dashboard" className="text-foreground underline-offset-4 hover:underline">
            Show all
          </Link>
        </p>
      )}
      {entries.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">No memories on these dates.</p>
      ) : (
        <EntryGrid entries={entries} />
      )}
    </div>
  );
}
