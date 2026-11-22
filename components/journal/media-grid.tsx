"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronLeft, ChevronRight, Play, Trash2 } from "lucide-react";
import { deleteMedia, setMediaOrder } from "@/app/(main)/journal/media-actions";
import type { MediaItem } from "@/lib/media";

const controlClass =
  "flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-40";

export function MediaGrid({ entryId, items }: { entryId: string; items: MediaItem[] }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(items);

  function move(index: number, delta: -1 | 1) {
    const next = [...shown];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    startTransition(async () => {
      setShown(next);
      const { error } = await setMediaOrder(entryId, next.map((m) => m.id));
      if (error) alert(`Couldn't reorder: ${error}`);
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this photo or video from the memory?")) return;
    startTransition(async () => {
      setShown(shown.filter((m) => m.id !== id));
      const { error } = await deleteMedia(id);
      if (error) alert(`Couldn't delete: ${error}`);
    });
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {shown.map((m, i) => (
        <li key={m.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
          {m.mediaType === "IMAGE" ? (
            // Signed URLs change per request, so the Next image optimizer adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <>
              <video
                src={`${m.url}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                  <Play className="h-5 w-5 fill-white" />
                </span>
              </span>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <div className="flex gap-1">
              <button
                type="button"
                className={controlClass}
                aria-label="Move earlier"
                disabled={pending || i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={controlClass}
                aria-label="Move later"
                disabled={pending || i === shown.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              className={controlClass}
              aria-label="Delete"
              disabled={pending}
              onClick={() => remove(m.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
