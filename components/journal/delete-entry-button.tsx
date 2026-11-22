"use client";

import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/journal/submit-button";

export function DeleteEntryButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this memory? This can't be undone.")) e.preventDefault();
      }}
    >
      <SubmitButton
        variant="ghost"
        size="sm"
        pendingText="Deleting…"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 /> Delete
      </SubmitButton>
    </form>
  );
}
