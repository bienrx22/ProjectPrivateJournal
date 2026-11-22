"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MusicPanel } from "@/components/journal/music-panel";
import type { MediaCaption, MediaItem } from "@/lib/media";

const navClass =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter disabled:opacity-30";

function VideoPlayer({ url, withMusic }: { url: string; withMusic: boolean }) {
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
      // With a song attached, the video's own sound is muted and it loops like a moving photo.
      controls={!withMusic}
      muted={withMusic}
      loop={withMusic}
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
  caption,
  onIndexChange,
  onClose,
}: {
  items: MediaItem[];
  index: number | null;
  caption: MediaCaption;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = index === null ? null : items[index];
  const [lyric, setLyric] = useState("");
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
      className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-black text-white backdrop:bg-black/80"
    >
      {item && index !== null && (
        <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
          {/* Media side */}
          <div className="relative flex min-h-[60dvh] flex-1 flex-col lg:min-h-0">
            <header className="flex items-center justify-between gap-4 pb-3 text-sm text-white/70">
              <span className="flex min-w-0 items-center gap-1.5">
                {caption.location && (
                  <>
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{caption.location}</span>
                    <span className="text-white/30">·</span>
                  </>
                )}
                <span className="shrink-0">{caption.date}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums text-white/50">
                  {index + 1} / {items.length}
                </span>
                <button type="button" aria-label="Close" onClick={onClose} className={navClass}>
                  <X className="h-5 w-5" />
                </button>
              </span>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {item.mediaType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
              ) : (
                <VideoPlayer key={item.id} url={item.url} withMusic={item.track != null} />
              )}

              {/* Synced lyric line, near the bottom of the media */}
              {item.track && lyric && (
                <p
                  key={lyric}
                  aria-live="polite"
                  className="pointer-events-none absolute inset-x-6 bottom-6 mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-1 text-balance text-center font-serif text-2xl leading-snug text-white duration-300 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] sm:bottom-10 sm:text-3xl"
                >
                  {lyric}
                </p>
              )}

              <button
                type="button"
                aria-label="Previous"
                disabled={!hasPrev}
                onClick={() => onIndexChange(index - 1)}
                className={`${navClass} absolute left-0 top-1/2 -translate-y-1/2 sm:left-2`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={!hasNext}
                onClick={() => onIndexChange(index + 1)}
                className={`${navClass} absolute right-0 top-1/2 -translate-y-1/2 sm:right-2`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Music side */}
          {item.track && (
            <div className="flex shrink-0 justify-center lg:items-center">
              <MusicPanel key={item.id} track={item.track} onLyric={setLyric} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
