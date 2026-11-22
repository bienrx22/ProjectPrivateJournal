import { Suspense } from "react";
import { EntryForm } from "@/components/journal/entry-form";
import { createEntry } from "@/app/(main)/journal/actions";
import { DATE_RE } from "@/lib/journal";

type SearchParams = Promise<{ date?: string }>;

export default function NewEntryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section>
      <h1 className="mb-8 font-serif text-4xl">New Memory</h1>
      <Suspense fallback={<div className="h-96 max-w-2xl animate-pulse rounded-xl bg-muted/60" />}>
        <NewEntryForm searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function NewEntryForm({ searchParams }: { searchParams: SearchParams }) {
  const { date } = await searchParams;
  return (
    <EntryForm
      action={createEntry}
      submitLabel="Save memory"
      cancelHref="/dashboard"
      defaultDate={date && DATE_RE.test(date) ? date : undefined}
    />
  );
}
