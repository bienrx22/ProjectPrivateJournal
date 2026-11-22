"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteEntryButton({
  action,
  title,
}: {
  action: () => Promise<{ error?: string }>;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 /> Delete
      </Button>

      <ConfirmDialog
        open={open}
        title="Delete this memory?"
        description={`“${title}” and all of its photos, videos and music will be permanently deleted.`}
        confirmLabel="Delete memory"
        pending={pending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            // On success the action redirects to the dashboard.
            const result = await action();
            if (result?.error) setError(result.error);
          })
        }
      />
    </>
  );
}
