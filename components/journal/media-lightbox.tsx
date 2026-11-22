"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { MediaItem } from "@/lib/media";

const navClass =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter disabled:opacity-30";

function VideoPlayer({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p className="max-w-sm text-center text-sm text-white/80">
        This video can&apos;t play in this browser. iPhone videos recorded in HEVC often need to be
        exported as MP4 (H.264) first.
      </p>
    );
  }
  return (
    <video
      src={url}
      controls
      autoPlay
      playsInline
      onError={() => setFailed(true)}
      className="max-h-full max-w-full rounded-lg"
    />
  );
}

export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: MediaItem[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = index === null ? null : items[index];
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;

  return (
    <Modal
      open={item != null}
      onClose={onClose}
      aria-label="Media viewer"
      onKeyDown={(e) => {
        if (index === null) return;
        if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
        if (e.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
      }}
      // The viewer stays black regardless of theme.
      className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-black/95 text-white backdrop:bg-black/80"
    >
      {item && index !== null && (
        <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-16">
          {item.mediaType === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <VideoPlayer key={item.id} url={item.url} />
          )}

          <button type="button" aria-label="Close" onClick={onClose} className={`${navClass} absolute right-4 top-4`}>
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Previous"
            disabled={!hasPrev}
            onClick={() => onIndexChange(index - 1)}
            className={`${navClass} absolute left-4 top-1/2 -translate-y-1/2`}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!hasNext}
            onClick={() => onIndexChange(index + 1)}
            className={`${navClass} absolute right-4 top-1/2 -translate-y-1/2`}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
            {index + 1} / {items.length}
          </p>
        </div>
      )}
    </Modal>
  );
}
