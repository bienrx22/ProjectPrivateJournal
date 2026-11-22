"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, FlagTriangleRight, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMs } from "@/lib/music";
import { loadYouTubeApi, youTubeErrorMessage, type YTPlayer } from "@/lib/youtube";

type Props = {
  videoId: string;
  startMs: number;
  endMs: number | null;
  defaultLengthMs: number;
  volume: number;
  onChange: (startMs: number, endMs: number | null) => void;
  onMeta: (meta: { title?: string; author?: string }) => void;
  onError: (message: string) => void;
};

/**
 * Small visible YouTube player (YouTube doesn't allow hidden playback) with
 * "Set start here / Set end here" controls. Remount (key) when `videoId` changes.
 */
export function YouTubeSegmentEditor({
  videoId,
  startMs,
  endMs,
  defaultLengthMs,
  volume,
  onChange,
  onMeta,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  const latest = useRef({ startMs, endMs, defaultLengthMs, volume, onChange, onMeta, onError });
  useEffect(() => {
    latest.current = { startMs, endMs, defaultLengthMs, volume, onChange, onMeta, onError };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    const mount = document.createElement("div");
    host.appendChild(mount);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: ({ target }) => {
              playerRef.current = target;
              const { startMs: s, endMs: e, defaultLengthMs: len, volume: v } = latest.current;
              target.setVolume(Math.round(v * 100));
              const duration = target.getDuration() * 1000;
              if (e == null) {
                const end = s + len;
                latest.current.onChange(s, duration > 0 ? Math.min(end, duration) : end);
              }
              latest.current.onMeta(target.getVideoData?.() ?? {});
              setReady(true);
            },
            onError: ({ data }) => latest.current.onError(youTubeErrorMessage(data)),
          },
        });
      })
      .catch((err: Error) => latest.current.onError(err.message));

    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [videoId]);

  // The player is the source of truth for time; poll it while mounted.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const t = player.getCurrentTime() * 1000;
      setTimeMs(t);
      if (stopAtRef.current != null && t >= stopAtRef.current) {
        stopAtRef.current = null;
        player.pauseVideo();
        setPreviewing(false);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [ready]);

  useEffect(() => {
    playerRef.current?.setVolume(Math.round(volume * 100));
  }, [volume]);

  function setStartHere() {
    const t = Math.round(timeMs);
    onChange(t, endMs != null && endMs > t ? endMs : t + defaultLengthMs);
  }

  function setEndHere() {
    const t = Math.round(timeMs);
    if (t <= startMs) {
      onError("The end must be after the start. Play a little further, then set the end.");
      return;
    }
    onChange(startMs, t);
  }

  function togglePreview() {
    const player = playerRef.current;
    if (!player) return;
    if (previewing) {
      stopAtRef.current = null;
      player.pauseVideo();
      setPreviewing(false);
      return;
    }
    player.seekTo(startMs / 1000, true);
    player.playVideo();
    stopAtRef.current = endMs;
    setPreviewing(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading YouTube…
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={setStartHere} disabled={!ready}>
          <Flag /> Set start here
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={setEndHere} disabled={!ready}>
          <FlagTriangleRight /> Set end here
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={togglePreview} disabled={!ready}>
          {previewing ? <Pause /> : <Play />}
          {previewing ? "Stop" : "Preview segment"}
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">at {formatMs(timeMs)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Play the video, then press <b>Set start here</b> and <b>Set end here</b> at the right moments.
      </p>
    </div>
  );
}
