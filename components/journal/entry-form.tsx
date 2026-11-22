"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/journal/submit-button";
import { MOODS, type Entry } from "@/lib/journal";
import type { EntryFormState } from "@/app/(main)/journal/actions";

type Props = {
  action: (prev: EntryFormState, formData: FormData) => Promise<EntryFormState>;
  entry?: Entry;
  submitLabel: string;
  cancelHref: string;
};

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EntryForm({ action, entry, submitLabel, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, {});
  const dateRef = useRef<HTMLInputElement>(null);

  // New memories default to today in the user's own timezone (unknown on the server).
  useEffect(() => {
    if (dateRef.current && !dateRef.current.value) dateRef.current.value = todayLocal();
  }, []);

  // After a failed submit, keep what the user typed instead of the original values.
  const v = (key: keyof Entry & string) =>
    state.values?.[key] ?? (entry?.[key] as string | null | undefined) ?? "";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          placeholder="A day at the beach"
          defaultValue={v("title")}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="entry_date">Date</Label>
          <Input
            ref={dateRef}
            id="entry_date"
            name="entry_date"
            type="date"
            required
            defaultValue={v("entry_date")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mood">Mood</Label>
          <Input
            id="mood"
            name="mood"
            list="mood-options"
            maxLength={50}
            placeholder="Happy"
            defaultValue={v("mood")}
          />
          <datalist id="mood-options">
            {MOODS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          placeholder="Baguio City"
          defaultValue={v("location")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="body">Description</Label>
        <textarea
          id="body"
          name="body"
          rows={8}
          placeholder="What made this moment special?"
          defaultValue={v("body")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
