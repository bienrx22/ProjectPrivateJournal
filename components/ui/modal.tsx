"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ModalProps = Omit<React.DialogHTMLAttributes<HTMLDialogElement>, "open" | "onClose"> & {
  open: boolean;
  onClose: () => void;
};

/**
 * Native <dialog> shown with showModal(): focus trap, Esc, and top-layer stacking
 * come from the browser. Children only mount while open, so videos stop on close.
 */
export function Modal({ open, onClose, className, children, ...props }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault(); // let the parent decide (e.g. not while deleting)
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      className={cn(
        "rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {open && children}
    </dialog>
  );
}
