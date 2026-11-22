"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MusicPanel } from "@/components/journal/music-panel";
import { unlockAudio } from "@/lib/playback";
import type { MediaCaption, MediaItem } from "@/lib/media";

const navClass =
  "flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter disabled:opacity-30 sm:h-11 sm:w-11";

const SWIPE_MIN_PX = 50;

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
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;

  /** Every navigation is a tap/key press, so use it to keep mobile audio unlocked. */
  function go(delta: -1 | 1) {
    if (index === null) return;
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    unlockAudio();
    onIndexChange(next);
  }

  return (
    <Modal
      open={item != null}
      onClose={onClose}
      aria-label="Media viewer"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      // The viewer stays black regardless of theme.
      className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-black text-white backdrop:bg-black/80"
    >
      {item && index !== null && (
        // Portrait: media on top, music below. Landscape (phones turned sideways and desktops): side by side.
        <div className="flex h-full w-full flex-col gap-3 p-3 sm:p-6 landscape:flex-row landscape:gap-4 landscape:p-3 lg:landscape:gap-6 lg:landscape:p-6">
          {/* Media side */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 pb-2 text-xs text-white/70 sm:text-sm">
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

            <div
              className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center"
              onTouchStart={(e) => {
                const t = e.touches[0];
                touchStart.current = { x: t.clientX, y: t.clientY };
              }}
              onTouchEnd={(e) => {
                const start = touchStart.current;
                touchStart.current = null;
                if (!start) return;
                const t = e.changedTouches[0];
                const dx = t.clientX - start.x;
                const dy = t.clientY - start.y;
                if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
              }}
            >
              {item.mediaType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" draggable={false} className="max-h-full max-w-full select-none rounded-lg object-contain" />
              ) : (
                <VideoPlayer key={item.id} url={item.url} withMusic={item.track != null} />
              )}

              {/* Synced lyric line, near the bottom of the media */}
              {item.track && lyric && (
                <p
                  key={lyric}
                  aria-live="polite"
                  className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-1 text-balance text-center font-serif text-lg leading-snug text-white duration-300 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] sm:inset-x-6 sm:bottom-8 sm:text-3xl"
                >
                  {lyric}
                </p>
              )}

              <button
                type="button"
                aria-label="Previous"
                disabled={!hasPrev}
                onClick={() => go(-1)}
                className={`${navClass} absolute left-0 top-1/2 -translate-y-1/2 sm:left-2`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={!hasNext}
                onClick={() => go(1)}
                className={`${navClass} absolute right-0 top-1/2 -translate-y-1/2 sm:right-2`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Music side */}
          {item.track && (
            <div className="flex shrink-0 justify-center landscape:max-h-full landscape:items-center landscape:overflow-y-auto">
              <MusicPanel key={item.id} track={item.track} onLyric={setLyric} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
