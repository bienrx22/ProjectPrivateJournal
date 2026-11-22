"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMs } from "@/lib/music";

type Props = {
  url: string;
  startMs: number;
  endMs: number | null;
  defaultLengthMs: number;
  volume: number;
  onChange: (startMs: number, endMs: number) => void;
  onError: (message: string) => void;
};

/**
 * Waveform with one draggable/resizable region = the segment that plays with the media.
 * Remount (key) when `url` changes so internal state starts fresh.
 */
export function AudioSegmentEditor({ url, startMs, endMs, defaultLengthMs, volume, onChange, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);

  // WaveSurfer callbacks are bound once per URL; read the latest props through a ref.
  const latest = useRef({ startMs, endMs, defaultLengthMs, volume, onChange, onError });
  useEffect(() => {
    latest.current = { startMs, endMs, defaultLengthMs, volume, onChange, onError };
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url,
      height: 96,
      waveColor: "#BEC7B9",
      progressColor: "#D16D3B",
      cursorColor: "#D16D3B",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      plugins: [regions],
    });
    wsRef.current = ws;

    ws.on("decode", (durationSec) => {
      const duration = durationSec * 1000;
      const { startMs: s, endMs: e, defaultLengthMs: len, volume: v } = latest.current;
      const start = Math.max(0, Math.min(s, duration - 1000));
      const end = Math.min(e ?? start + len, duration);
      regionRef.current = regions.addRegion({
        start: start / 1000,
        end: end / 1000,
        color: "rgba(209, 109, 59, 0.18)",
        drag: true,
        resize: true,
      });
      ws.setVolume(v);
      latest.current.onChange(Math.round(start), Math.round(end));
      setReady(true);
    });
    regions.on("region-updated", (r) =>
      latest.current.onChange(Math.round(r.start * 1000), Math.round(r.end * 1000)),
    );
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));
    ws.on("timeupdate", (t) => setTimeMs(t * 1000));
    ws.on("error", (err) => latest.current.onError(`Couldn't read this audio file: ${err.message}`));

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionRef.current = null;
    };
  }, [url]);

  // Typed start/end → move the region.
  useEffect(() => {
    const region = regionRef.current;
    if (!region || endMs == null) return;
    if (Math.abs(region.start * 1000 - startMs) > 1 || Math.abs(region.end * 1000 - endMs) > 1) {
      region.setOptions({ start: startMs / 1000, end: endMs / 1000 });
    }
  }, [startMs, endMs]);

  useEffect(() => {
    wsRef.current?.setVolume(volume);
  }, [volume]);

  function togglePreview() {
    const ws = wsRef.current;
    if (!ws) return;
    if (playing) ws.pause();
    else ws.play(startMs / 1000, endMs != null ? endMs / 1000 : undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-lg border bg-background p-2">
        <div ref={containerRef} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading audio…
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={togglePreview} disabled={!ready}>
          {playing ? <Pause /> : <Play />}
          {playing ? "Pause" : "Preview segment"}
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">{formatMs(timeMs)}</span>
        <span className="text-xs text-muted-foreground">Drag the highlighted area, or its edges, to choose the part that plays.</span>
      </div>
    </div>
  );
}
