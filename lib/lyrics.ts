/** A lyric line; startMs is relative to the start of the track's selected segment. */
export type LyricLine = { text: string; startMs: number };

export const MAX_LYRIC_LINES = 500;
export const MAX_LYRIC_LINE_LENGTH = 500;
export const MAX_OFFSET_MS = 10_000;

/** Parses LRC ("[01:23.45] text", several stamps per line allowed) into time-sorted lines (song time). */
export function parseLrc(lrc: string): { timeMs: number; text: string }[] {
  const out: { timeMs: number; text: string }[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) {
      out.push({ timeMs: Math.round((Number(s[1]) * 60 + Number(s[2])) * 1000), text });
    }
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Converts song-time LRC lines to segment-relative lines:
 * clipStartMs = lrcTimeMs - segmentStartMs, keeping only lines inside the segment.
 * The line already being sung when the segment starts is kept at 0.
 */
export function lrcToSegment(
  lines: { timeMs: number; text: string }[],
  segmentStartMs: number,
  segmentEndMs: number | null,
): LyricLine[] {
  const end = segmentEndMs ?? Number.POSITIVE_INFINITY;
  const result: LyricLine[] = [];
  const before = lines.filter((l) => l.timeMs < segmentStartMs).at(-1);
  if (before && before.text && !lines.some((l) => l.timeMs === segmentStartMs)) {
    result.push({ text: before.text, startMs: 0 });
  }
  for (const l of lines) {
    if (l.timeMs >= segmentStartMs && l.timeMs < end) {
      result.push({ text: l.text, startMs: l.timeMs - segmentStartMs });
    }
  }
  return result;
}

/** Index of the line showing at segment time `tMs`, or -1 before the first line. */
export function activeLineIndex(lines: LyricLine[], tMs: number, offsetMs: number) {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startMs + offsetMs <= tMs) index = i;
    else break;
  }
  return index;
}
