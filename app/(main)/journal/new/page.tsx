import { EntryForm } from "@/components/journal/entry-form";
import { createEntry } from "@/app/(main)/journal/actions";

export default function NewEntryPage() {
  return (
    <section>
      <h1 className="mb-8 font-serif text-4xl">New Memory</h1>
      <EntryForm action={createEntry} submitLabel="Save memory" cancelHref="/dashboard" />
    </section>
  );
}
