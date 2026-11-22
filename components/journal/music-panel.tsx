"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Music2, Pause, Play } from "lucide-react";
import { createAudioClock, createYouTubeClock, type PlaybackClock } from "@/lib/playback";
import { formatClock } from "@/lib/music";
import { activeLineIndex } from "@/lib/lyrics";
import type { ViewerTrack } from "@/lib/media";

/**
 * Right-hand "Music Details" panel of the viewer. Plays the track's segment on a loop.
 * Remount (key) per media item so each item starts fresh.
 */
export function MusicPanel({
  track,
  onLyric,
}: {
  track: ViewerTrack;
  /** Called with the current lyric line (or "") whenever it changes. */
  onLyric?: (text: string) => void;
}) {
  const onLyricRef = useRef(onLyric);
  useEffect(() => {
    onLyricRef.current = onLyric;
  });
  const ytHostRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<PlaybackClock | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lengthMs, setLengthMs] = useState<number | null>(
    track.endMs != null ? track.endMs - track.startMs : null,
  );

  useEffect(() => {
    const { startMs, endMs } = track;
    let raf = 0;
    let cancelled = false;

    const events = {
      onPlayingChange: (p: boolean) => setPlaying(p),
      onError: (msg: string) => setError(msg),
      onReady: async () => {
        if (cancelled) return;
        const c = clockRef.current!;
        c.setVolume(track.volume);
        c.seek(startMs);
        if (endMs == null) {
          const d = c.getDurationMs();
          if (d) setLengthMs(d - startMs);
        }
        setReady(true);
        const started = await c.play();
        if (!cancelled && !started) setBlocked(true);
      },
    };

    if (track.source === "upload" && track.audioUrl) {
      clockRef.current = createAudioClock(track.audioUrl, events);
    } else if (track.source === "youtube" && track.youtubeVideoId && ytHostRef.current) {
      clockRef.current = createYouTubeClock(ytHostRef.current, track.youtubeVideoId, startMs, events);
    } else {
      queueMicrotask(() => setError("This song can't be played."));
      return;
    }

    // Loop the segment; the player stays the source of truth for time.
    let lastLyric = -2;
    const tick = () => {
      const c = clockRef.current;
      if (c) {
        const t = c.getTimeMs();
        const end = endMs ?? c.getDurationMs();
        if (end != null && t >= end - 50 && c.isPlaying()) c.seek(startMs);
        const segmentMs = Math.max(0, t - startMs);
        setElapsedMs(segmentMs);
        const li = activeLineIndex(track.lyrics, segmentMs, track.lyricsOffsetMs);
        if (li !== lastLyric) {
          lastLyric = li;
          onLyricRef.current?.(li >= 0 ? track.lyrics[li].text : "");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clockRef.current?.destroy();
      clockRef.current = null;
      onLyricRef.current?.("");
    };
  }, [track]);

  async function toggle() {
    const c = clockRef.current;
    if (!c) return;
    if (playing) {
      c.pause();
      return;
    }
    const started = await c.play();
    setBlocked(!started);
  }

  const progress = lengthMs ? Math.min(1, elapsedMs / lengthMs) : 0;

  return (
    <aside className="flex w-full flex-col gap-5 rounded-2xl bg-white/[0.06] p-5 text-white lg:w-80" aria-label="Music details">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Music Details</p>

      {track.source === "youtube" && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <div ref={ytHostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-butter text-[#3a2c25]">
          <Music2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-serif text-xl leading-tight">{track.title}</p>
          {track.artist && <p className="truncate text-sm text-white/60">{track.artist}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-butter transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs tabular-nums text-white/60">
          <span>{formatClock(elapsedMs)}</span>
          <span>{formatClock(lengthMs)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "Pause music" : "Play music"}
        className="flex h-12 w-12 items-center justify-center self-center rounded-full bg-butter text-[#3a2c25] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
      >
        {!ready ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current" />
        )}
      </button>

      {blocked && !playing && (
        <p className="text-center text-xs text-white/60">Your browser paused autoplay. Press play to start the music.</p>
      )}
      {error && <p className="text-center text-xs text-red-300">{error}</p>}
    </aside>
  );
}
