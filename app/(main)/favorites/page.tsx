import { Suspense } from "react";
import { EntryGrid, EntryGridSkeleton } from "@/components/journal/entry-card";
import { createClient } from "@/lib/supabase/server";

export default function FavoritesPage() {
  return (
    <section>
      <h1 className="font-serif text-4xl">Favorites</h1>
      <div className="mt-8">
        <Suspense fallback={<EntryGridSkeleton />}>
          <FavoriteList />
        </Suspense>
      </div>
    </section>
  );
}

async function FavoriteList() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("is_favorite", true)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  if (entries.length === 0) {
    return <p className="mt-16 text-center text-muted-foreground">Star a memory to see it here.</p>;
  }
  return <EntryGrid entries={entries} />;
}
