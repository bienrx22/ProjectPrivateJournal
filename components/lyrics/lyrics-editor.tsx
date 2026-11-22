"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  Hand,
  ListPlus,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TimeField } from "@/components/music/time-field";
import { saveLyrics, searchLyrics, type LrclibResult } from "@/app/(main)/journal/lyrics-actions";
import { createAudioClock, createYouTubeClock, type PlaybackClock } from "@/lib/playback";
import { formatClock, formatMs } from "@/lib/music";
import { MAX_OFFSET_MS, activeLineIndex, lrcToSegment, parseLrc, type LyricLine } from "@/lib/lyrics";
import type { ViewerTrack } from "@/lib/media";
import { cn } from "@/lib/utils";

type Row = { key: string; text: string; startMs: number | null };

const toRows = (lines: { text: string; startMs: number | null }[]): Row[] =>
  lines.map((l) => ({ key: crypto.randomUUID(), text: l.text, startMs: l.startMs }));

type Props = {
  entryId: string;
  mediaId: string;
  track: ViewerTrack;
  initialLines: LyricLine[];
  initialOffsetMs: number;
};

export function LyricsEditor({ entryId, mediaId, track, initialLines, initialOffsetMs }: Props) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialLines));
  const [offsetMs, setOffsetMs] = useState(initialOffsetMs);
  const [cursor, setCursor] = useState(() => {
    const i = initialLines.length;
    return i > 0 ? i : 0;
  });

  // Playback
  const ytHostRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<PlaybackClock | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0); // segment-relative
  const [lengthMs, setLengthMs] = useState<number | null>(
    track.endMs != null ? track.endMs - track.startMs : null,
  );

  // Text mode
  const [editingText, setEditingText] = useState(initialLines.length === 0);
  const [draft, setDraft] = useState(() => initialLines.map((l) => l.text).join("\n"));

  // LRCLIB
  const [results, setResults] = useState<LrclibResult[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [pendingImport, setPendingImport] = useState<LyricLine[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();

  const timeRef = useRef(0);
  const markRef = useRef<() => void>(() => {});

  // ---- Player ----
  useEffect(() => {
    const { startMs, endMs } = track;
    let raf = 0;
    const events = {
      onPlayingChange: (p: boolean) => setPlaying(p),
      onError: (msg: string) => setError(msg),
      onReady: () => {
        const c = clockRef.current!;
        c.setVolume(track.volume);
        c.seek(startMs);
        if (endMs == null) {
          const d = c.getDurationMs();
          if (d) setLengthMs(d - startMs);
        }
        setReady(true);
      },
    };
    if (track.source === "upload" && track.audioUrl) {
      clockRef.current = createAudioClock(track.audioUrl, events);
    } else if (track.source === "youtube" && track.youtubeVideoId && ytHostRef.current) {
      clockRef.current = createYouTubeClock(ytHostRef.current, track.youtubeVideoId, startMs, events);
    }

    const tick = () => {
      const c = clockRef.current;
      if (c) {
        const abs = c.getTimeMs();
        const end = endMs ?? c.getDurationMs();
        if (end != null && abs >= end && c.isPlaying()) {
          c.pause(); // the editor stops at the segment end instead of looping
          c.seek(end);
        }
        const t = Math.max(0, abs - startMs);
        timeRef.current = t;
        setTimeMs(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clockRef.current?.destroy();
      clockRef.current = null;
    };
  }, [track]);

  async function togglePlay() {
    const c = clockRef.current;
    if (!c) return;
    if (playing) {
      c.pause();
      return;
    }
    if (lengthMs != null && timeRef.current >= lengthMs - 100) c.seek(track.startMs);
    const ok = await c.play();
    if (!ok) setError("The browser blocked playback. Press play again.");
  }

  function seekTo(segmentMs: number) {
    clockRef.current?.seek(track.startMs + Math.max(0, segmentMs));
  }

  function restart() {
    seekTo(0);
    setCursor(0);
  }

  // ---- Editing ----
  function touched() {
    setSaved(false);
    setError(null);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    touched();
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    touched();
    setRows((all) => all.filter((r) => r.key !== key));
  }

  /** Assign the current time to the line at the cursor, then move to the next line. */
  function markNext() {
    if (cursor >= rows.length) return;
    touched();
    const t = Math.round(timeRef.current);
    setRows((all) => all.map((r, i) => (i === cursor ? { ...r, startMs: t } : r)));
    setCursor((c) => c + 1);
  }
  useEffect(() => {
    markRef.current = markNext;
  });

  // Space marks the next line while timing (unless typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true]")) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        markRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyDraft() {
    touched();
    const texts = draft.split(/\r?\n/).map((t) => t.trim());
    while (texts.length && !texts[texts.length - 1]) texts.pop();
    // Keep existing times by position so small text fixes don't lose timing.
    setRows((old) => texts.map((text, i) => ({ key: old[i]?.key ?? crypto.randomUUID(), text, startMs: old[i]?.startMs ?? null })));
    setCursor((c) => Math.min(c, texts.length));
    setEditingText(false);
  }

  function openTextEditor() {
    setDraft(rows.map((r) => r.text).join("\n"));
    setEditingText(true);
  }

  function findLyrics() {
    touched();
    setNotice(null);
    startSearch(async () => {
      const res = await searchLyrics(track.title, track.artist ?? "");
      if (res.error) setError(res.error);
      else setResults(res.results ?? []);
    });
  }

  function chooseResult(r: LrclibResult) {
    let imported: LyricLine[];
    let message: string;
    if (r.synced) {
      imported = lrcToSegment(parseLrc(r.synced), track.startMs, track.endMs);
      message = imported.length
        ? `Imported ${imported.length} timed lines that fall inside your segment. Play it through and fix anything that's off.`
        : "These lyrics have no lines inside your segment. Check the segment on the Music tab.";
    } else {
      imported = (r.plain ?? "")
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text, startMs: -1 }));
      message = "These lyrics aren't synced. Use live timing to set each line, and remove lines outside your segment.";
    }
    setResults(null);
    if (rows.length) setPendingImport(imported.map((l) => ({ ...l, startMs: l.startMs })));
    else applyImport(imported);
    setNotice(message);
  }

  function applyImport(lines: LyricLine[]) {
    touched();
    setRows(toRows(lines.map((l) => ({ text: l.text, startMs: l.startMs >= 0 ? l.startMs : null }))));
    setCursor(lines.findIndex((l) => l.startMs < 0) === -1 ? lines.length : 0);
    setEditingText(false);
    setPendingImport(null);
  }

  function save() {
    touched();
    const untimed = rows.filter((r) => r.startMs == null).length;
    if (untimed) {
      setError(`${untimed} line${untimed === 1 ? " has" : "s have"} no time yet. Time ${untimed === 1 ? "it" : "them"} or remove ${untimed === 1 ? "it" : "them"}.`);
      return;
    }
    startSave(async () => {
      const res = await saveLyrics(mediaId, {
        lines: rows.map((r) => ({ text: r.text, startMs: r.startMs! })),
        offsetMs,
      });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  // Preview: which line is showing right now.
  const timedLines: LyricLine[] = rows
    .filter((r) => r.startMs != null)
    .map((r) => ({ text: r.text, startMs: r.startMs! }))
    .sort((a, b) => a.startMs - b.startMs);
  const active = activeLineIndex(timedLines, timeMs, offsetMs);
  const activeText = active >= 0 ? timedLines[active].text : "";
  const activeRowKey = active >= 0 ? rows.find((r) => r.startMs === timedLines[active].startMs && r.text === activeText)?.key : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Player + live preview */}
      <div className="flex flex-col gap-4 rounded-xl bg-[#1a1512] p-4 text-white">
        {track.source === "youtube" && (
          <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-lg bg-black">
            <div ref={ytHostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
          </div>
        )}
        <p className="min-h-[3.5rem] text-center font-serif text-2xl leading-snug" aria-live="polite">
          {activeText || <span className="text-white/30">♪</span>}
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-butter"
              style={{ width: `${lengthMs ? Math.min(100, (timeMs / lengthMs) * 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-white/60">
            <span>{formatMs(timeMs)}</span>
            <span>{formatClock(lengthMs)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={restart}
            disabled={!ready}
            aria-label="Back to segment start"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-butter text-[#3a2c25] transition hover:scale-105 disabled:opacity-40"
          >
            {!ready ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={markNext}
            disabled={!ready || cursor >= rows.length || editingText}
            className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm transition hover:bg-white/20 disabled:opacity-40"
          >
            <Hand className="h-4 w-4" />
            {cursor < rows.length ? `Mark line ${cursor + 1}` : "All lines marked"}
            <kbd className="rounded bg-white/15 px-1.5 text-[10px]">Space</kbd>
          </button>
        </div>
      </div>

      {/* Lines */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl">Lines</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={findLyrics} disabled={searching}>
              {searching ? <Loader2 className="animate-spin" /> : <Search />} Find synced lyrics
            </Button>
            {!editingText && (
              <Button type="button" variant="outline" size="sm" onClick={openTextEditor}>
                <ListPlus /> Edit text
              </Button>
            )}
          </div>
        </div>

        {results && (
          <div className="rounded-lg border">
            {results.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No lyrics found for “{track.title}”. Check the song title and artist on the Music tab, or type them in.
              </p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => chooseResult(r)}
                      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.trackName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.artistName}
                          {r.albumName ? ` · ${r.albumName}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {r.durationSec ? formatClock(r.durationSec * 1000) : ""}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs",
                          r.synced ? "bg-butter text-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.synced ? "Synced" : "Text only"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t p-2 text-xs text-muted-foreground">
              <span>From LRCLIB, a free community lyrics database. Always review before saving.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setResults(null)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {notice && <p className="rounded-md bg-butter/40 px-3 py-2 text-sm">{notice}</p>}

        {editingText ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="lyrics-text">Lyrics, one line per row</Label>
            <textarea
              id="lyrics-text"
              rows={12}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"First line\nSecond line\n…"}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={applyDraft} disabled={!draft.trim()}>
                Use these lines
              </Button>
              {rows.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setEditingText(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No lyrics yet. Use <b>Find synced lyrics</b>, or <b>Edit text</b> to type them.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-1.5 transition",
                  r.key === activeRowKey && "border-jaffa bg-butter/30",
                  i === cursor && "ring-2 ring-jaffa/50",
                )}
              >
                <button
                  type="button"
                  title="Time again from this line"
                  aria-label={`Time again from line ${i + 1}`}
                  onClick={() => {
                    setCursor(i);
                    seekTo((r.startMs ?? rows[i - 1]?.startMs ?? 0) - 2000);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Timer className="h-4 w-4" />
                </button>
                <TimeField
                  id={`t-${r.key}`}
                  valueMs={r.startMs}
                  onCommit={(ms) => updateRow(r.key, { startMs: ms })}
                  className="h-9 w-24"
                />
                <input
                  value={r.text}
                  onChange={(e) => updateRow(r.key, { text: e.target.value })}
                  placeholder="(instrumental)"
                  aria-label={`Line ${i + 1} text`}
                  className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => removeRow(r.key)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Offset */}
      <div className="grid gap-1.5">
        <Label htmlFor="offset">
          Timing offset: {offsetMs > 0 ? "+" : ""}
          {(offsetMs / 1000).toFixed(1)}s{" "}
          <span className="font-normal text-muted-foreground">
            (negative shows lyrics earlier, positive later, e.g. for YouTube intros)
          </span>
        </Label>
        <input
          id="offset"
          type="range"
          min={-MAX_OFFSET_MS / 2}
          max={MAX_OFFSET_MS / 2}
          step={100}
          value={offsetMs}
          onChange={(e) => {
            touched();
            setOffsetMs(Number(e.target.value));
          }}
          className="h-9 accent-jaffa"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="button" onClick={save} disabled={saving || editingText}>
          {saving ? "Saving…" : "Save lyrics"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/journal/${entryId}`}>Back to memory</Link>
        </Button>
        {saved && !saving && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>

      <ConfirmDialog
        open={pendingImport != null}
        title="Replace your lyrics?"
        description="The lines you have now will be replaced by the imported ones. Nothing is saved until you press Save lyrics."
        confirmLabel="Replace"
        onCancel={() => {
          setPendingImport(null);
          setNotice(null);
        }}
        onConfirm={() => pendingImport && applyImport(pendingImport)}
      />
    </div>
  );
}
