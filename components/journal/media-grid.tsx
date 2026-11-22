"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Play, Trash2 } from "lucide-react";
import { deleteMedia, setMediaOrder } from "@/app/(main)/journal/media-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MediaLightbox } from "@/components/journal/media-lightbox";
import type { MediaItem } from "@/lib/media";

const controlClass =
  "flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-40";

/** Always visible on touch screens; on larger screens, shown on hover or keyboard focus. */
const revealClass = "transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

export function MediaGrid({ entryId, items }: { entryId: string; items: MediaItem[] }) {
  const [shown, setShown] = useOptimistic(items);
  const [reordering, startReorder] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [orderError, setOrderError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmItem = shown.find((m) => m.id === confirmId);

  function move(index: number, delta: -1 | 1) {
    const next = [...shown];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setOrderError(null);
    startReorder(async () => {
      setShown(next);
      const { error } = await setMediaOrder(entryId, next.map((m) => m.id));
      if (error) setOrderError(`Couldn't save the new order: ${error}`);
    });
  }

  function confirmDelete() {
    if (!confirmId) return;
    startDelete(async () => {
      const { error } = await deleteMedia(confirmId);
      if (error) setDeleteError(error);
      else setConfirmId(null);
    });
  }

  return (
    <>
      {orderError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {orderError}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((m, i) => (
          <li key={m.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
            <button
              type="button"
              onClick={() => setViewing(i)}
              aria-label={m.mediaType === "IMAGE" ? `Open photo ${i + 1}` : `Play video ${i + 1}`}
              className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {m.mediaType === "IMAGE" ? (
                // Signed URLs change per request, so the Next image optimizer adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
              ) : (
                <>
                  <video
                    src={`${m.url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    tabIndex={-1}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition group-hover:scale-110">
                      <Play className="h-5 w-5 fill-white" />
                    </span>
                  </span>
                </>
              )}
            </button>

            {/* Controls sit on top of the open button as separate positioned boxes, so only they catch clicks. */}
            <div className={`absolute bottom-2 left-2 flex gap-1 ${revealClass}`}>
                <button
                  type="button"
                  className={controlClass}
                  aria-label="Move earlier"
                  disabled={reordering || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={controlClass}
                  aria-label="Move later"
                  disabled={reordering || i === shown.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
            </div>
            <button
              type="button"
              className={`${controlClass} absolute bottom-2 right-2 ${revealClass}`}
              aria-label="Delete"
              onClick={() => {
                setDeleteError(null);
                setConfirmId(m.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <MediaLightbox
        items={shown}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={confirmItem != null}
        title={confirmItem?.mediaType === "VIDEO" ? "Delete this video?" : "Delete this photo?"}
        description="It will be removed from this memory and permanently deleted from storage."
        pending={deleting}
        error={deleteError}
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
