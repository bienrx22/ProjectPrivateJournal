import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryGrid } from "@/components/journal/entry-card";
import { createClient } from "@/lib/supabase/server";

const RECENT_LIMIT = 9;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT + 1);

  if (error) throw new Error(error.message);
  const hasMore = entries.length > RECENT_LIMIT;

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

      {entries.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">No memories yet.</p>
          <Button asChild variant="outline">
            <Link href="/journal/new">Write your first memory</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <EntryGrid entries={entries.slice(0, RECENT_LIMIT)} />
          {hasMore && (
            <Link href="/journal" className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline">
              See all memories →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
