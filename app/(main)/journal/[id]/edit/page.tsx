import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/journal/entry-form";
import { updateEntry } from "@/app/(main)/journal/actions";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/journal";

type Params = Promise<{ id: string }>;

export default function EditEntryPage({ params }: { params: Params }) {
  return (
    <section>
      <h1 className="mb-8 font-serif text-4xl">Edit Memory</h1>
      <Suspense fallback={<div className="h-96 max-w-2xl animate-pulse rounded-xl bg-muted/60" />}>
        <EditForm params={params} />
      </Suspense>
    </section>
  );
}

async function EditForm({ params }: { params: Params }) {
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
    <EntryForm
      action={updateEntry.bind(null, entry.id)}
      entry={entry}
      submitLabel="Save changes"
      cancelHref={`/journal/${entry.id}`}
    />
  );
}
