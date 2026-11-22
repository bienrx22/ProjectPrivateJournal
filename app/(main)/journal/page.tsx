import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntryGrid } from "@/components/journal/entry-card";
import { createClient } from "@/lib/supabase/server";
import { DATE_RE } from "@/lib/journal";

type SearchParams = Promise<{ q?: string; from?: string; to?: string }>;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const from = DATE_RE.test(params.from ?? "") ? params.from! : "";
  const to = DATE_RE.test(params.to ?? "") ? params.to! : "";
  const filtering = Boolean(q || from || to);

  const supabase = await createClient();
  let query = supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (q) {
    // Strip characters that have meaning in PostgREST filters / LIKE patterns.
    const term = q.replace(/[,()"\\%_*]/g, " ").trim();
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,body.ilike.%${term}%,location.ilike.%${term}%,mood.ilike.%${term}%`,
      );
    }
  }
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);

  const { data: entries, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-4xl">All Memories</h1>
        <Button asChild>
          <Link href="/journal/new">
            <Plus /> New Memory
          </Link>
        </Button>
      </div>

      <form method="get" className="mt-8 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="grid min-w-[12rem] flex-1 gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Title, place, mood, words…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit" variant="secondary">
          <Search /> Search
        </Button>
        {filtering && (
          <Button asChild variant="ghost">
            <Link href="/journal">Clear</Link>
          </Button>
        )}
      </form>

      <div className="mt-8">
        {entries.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            {filtering ? "No memories match your search." : "No memories yet."}
          </p>
        ) : (
          <>
            {filtering && (
              <p className="mb-4 text-sm text-muted-foreground">
                {entries.length} {entries.length === 1 ? "memory" : "memories"} found
              </p>
            )}
            <EntryGrid entries={entries} />
          </>
        )}
      </div>
    </section>
  );
}
