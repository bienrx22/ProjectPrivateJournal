"use client";

import { useId } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onCancel();
      }}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="w-[min(26rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="font-serif text-xl">
              {title}
            </h2>
            <p id={descId} className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending} autoFocus>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
