import { notFound } from "next/navigation";
import { EntryForm } from "@/components/journal/entry-form";
import { updateEntry } from "@/app/(main)/journal/actions";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
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
    <section>
      <h1 className="mb-8 font-serif text-4xl">Edit Memory</h1>
      <EntryForm
        action={updateEntry.bind(null, entry.id)}
        entry={entry}
        submitLabel="Save changes"
        cancelHref={`/journal/${entry.id}`}
      />
    </section>
  );
}
