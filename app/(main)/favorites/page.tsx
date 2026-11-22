import { EntryGrid } from "@/components/journal/entry-card";
import { createClient } from "@/lib/supabase/server";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("is_favorite", true)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <section>
      <h1 className="font-serif text-4xl">Favorites</h1>
      <div className="mt-8">
        {entries.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            Star a memory to see it here.
          </p>
        ) : (
          <EntryGrid entries={entries} />
        )}
      </div>
    </section>
  );
}
