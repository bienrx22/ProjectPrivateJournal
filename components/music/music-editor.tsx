"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Music, Search, Trash2, Upload, Volume2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AudioSegmentEditor } from "@/components/music/audio-segment-editor";
import { YouTubeSegmentEditor } from "@/components/music/youtube-segment-editor";
import { createClient } from "@/lib/supabase/client";
import { deleteTrack, findSongs, saveTrack } from "@/app/(main)/journal/music-actions";
import type { SongResult } from "@/lib/youtube-search";
import {
  AUDIO_BUCKET,
  AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  audioExtension,
  formatMs,
  parseTime,
  titleFromFileName,
  type Track,
  type TrackSource,
} from "@/lib/music";
import { parseYouTubeId } from "@/lib/youtube";
import { cn } from "@/lib/utils";

type Props = {
  entryId: string;
  mediaId: string;
  userId: string;
  track: Track | null;
  /** Signed URL of the saved audio file, when the saved track is an upload. */
  savedAudioUrl: string | null;
  defaultLengthMs: number;
};

/** "Artist - Song (Official Video)" â†’ { artist, title }, tidied up. */
function splitYouTubeTitle(raw: string, author?: string) {
  const clean = (s: string) =>
    s
      .replace(/\s*[([](official|lyric|lyrics|audio|video|music video|mv|hd|4k|visualizer)[^)\]]*[)\]]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  const parts = raw.split(/\s[-â€“â€”]\s/);
  if (parts.length >= 2) return { artist: clean(parts[0]), title: clean(parts.slice(1).join(" - ")) };
  return {
    artist: (author ?? "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim(),
    title: clean(raw),
  };
}

function TimeField({ id, label, valueMs, onCommit }: { id: string; label: string; valueMs: number | null; onCommit: (ms: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        key={valueMs ?? "none"}
        id={id}
        inputMode="decimal"
        defaultValue={valueMs == null ? "" : formatMs(valueMs)}
        placeholder="0:00.0"
        className="w-28 tabular-nums"
        onBlur={(e) => {
          const ms = parseTime(e.currentTarget.value);
          if (ms == null) e.currentTarget.value = valueMs == null ? "" : formatMs(valueMs);
          else if (ms !== valueMs) onCommit(ms);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function MusicEditor({ entryId, mediaId, userId, track, savedAudioUrl, defaultLengthMs }: Props) {
  const [source, setSource] = useState<TrackSource>(track?.source === "youtube" ? "youtube" : "upload");

  // Upload source
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(savedAudioUrl);

  // YouTube source
  const [youtubeInput, setYoutubeInput] = useState(
    track?.youtube_video_id ? `https://youtu.be/${track.youtube_video_id}` : "",
  );
  const [videoId, setVideoId] = useState<string | null>(track?.youtube_video_id ?? null);
  const [results, setResults] = useState<SongResult[] | null>(null);
  const [searching, startSearch] = useTransition();

  // Shared
  const [title, setTitle] = useState(track?.title ?? "");
  const [artist, setArtist] = useState(track?.artist ?? "");
  const [startMs, setStartMs] = useState(track?.start_ms ?? 0);
  const [endMs, setEndMs] = useState<number | null>(track?.end_ms ?? null);
  const [volume, setVolume] = useState(track?.volume ?? 1);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const savedUploadPath = track?.source === "upload" ? track.storage_path : null;

  // Release blob: URLs created for local previews.
  useEffect(() => {
    return () => {
      if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function changed() {
    setSaved(false);
    setError(null);
  }

  function setSegment(start: number, end: number | null) {
    setStartMs(start);
    setEndMs(end);
    setSaved(false);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    changed();
    if (!AUDIO_TYPES.includes(f.type)) {
      setError("Unsupported audio type. Use MP3, M4A, AAC, WAV, OGG, WebM or FLAC.");
      return;
    }
    if (f.size > MAX_AUDIO_BYTES) {
      setError("That file is larger than 50 MB.");
      return;
    }
    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setSegment(0, null);
    if (!title.trim()) setTitle(titleFromFileName(f.name));
  }

  function pickVideo(id: string, guess?: { title: string; artist: string }) {
    if (id !== videoId) {
      setVideoId(id);
      setSegment(0, null);
    }
    if (guess) {
      setTitle(guess.title);
      setArtist(guess.artist);
    }
    setResults(null);
  }

  /** A link loads directly; anything else searches YouTube's Music category. */
  function searchOrLoad() {
    changed();
    const id = parseYouTubeId(youtubeInput);
    if (id) {
      pickVideo(id);
      return;
    }
    startSearch(async () => {
      const res = await findSongs(youtubeInput);
      if (res.error) {
        setError(res.error);
        setResults(null);
      } else {
        setResults(res.results ?? []);
      }
    });
  }

  function save() {
    changed();
    startSave(async () => {
      let storagePath: string | null = null;
      let uploadedNow = false;

      if (source === "upload") {
        if (file) {
          storagePath = `${userId}/${mediaId}/${crypto.randomUUID()}.${audioExtension(file)}`;
          const { error: uploadError } = await createClient()
            .storage.from(AUDIO_BUCKET)
            .upload(storagePath, file, { contentType: file.type, upsert: false });
          if (uploadError) {
            setError(`Upload failed: ${uploadError.message}`);
            return;
          }
          uploadedNow = true;
        } else if (savedUploadPath) {
          storagePath = savedUploadPath;
        } else {
          setError("Choose an audio file first.");
          return;
        }
      } else if (!videoId) {
        setError("Paste a YouTube link and press Load first.");
        return;
      }

      const result = await saveTrack(mediaId, {
        source,
        storagePath,
        youtubeVideoId: source === "youtube" ? videoId : null,
        title,
        artist,
        startMs,
        endMs,
        volume,
      });

      if (result.error) {
        if (uploadedNow && storagePath) await createClient().storage.from(AUDIO_BUCKET).remove([storagePath]);
        setError(result.error);
        return;
      }
      setFile(null);
      setSaved(true);
    });
  }

  function removeTrack() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteTrack(mediaId);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setConfirmDelete(false);
      setFile(null);
      setAudioUrl(null);
      setVideoId(null);
      setYoutubeInput("");
      setTitle("");
      setArtist("");
      setSegment(0, null);
      setVolume(1);
      setSaved(false);
    });
  }

  const hasAudio = source === "upload" ? Boolean(audioUrl) : Boolean(videoId);

  return (
    <div className="flex flex-col gap-8">
      {/* Source */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Music source">
        {(
          [
            ["upload", "Upload audio", Upload],
            ["youtube", "YouTube link", Youtube],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={source === value}
            onClick={() => {
              changed();
              setSource(value);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              source === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {source === "upload" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Music /> {audioUrl ? "Choose a different file" : "Choose audio file"}
            </Button>
            <span className="truncate text-sm text-muted-foreground">
              {file ? file.name : savedUploadPath ? "Saved audio file" : "MP3, M4A, WAV, OGG, FLAC Â· up to 50 MB"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={AUDIO_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {audioUrl && (
            <AudioSegmentEditor
              key={audioUrl}
              url={audioUrl}
              startMs={startMs}
              endMs={endMs}
              defaultLengthMs={defaultLengthMs}
              volume={volume}
              onChange={setSegment}
              onError={setError}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              searchOrLoad();
            }}
          >
            <Input
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              placeholder="Search a song, or paste a YouTube link"
              aria-label="Search songs or paste a YouTube link"
            />
            <Button type="submit" variant="outline" disabled={searching || !youtubeInput.trim()}>
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
              {parseYouTubeId(youtubeInput) ? "Load" : "Search"}
            </Button>
          </form>

          {results && (
            <div className="rounded-lg border">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No songs found. Try the artist and title together.</p>
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto" aria-label="Search results">
                  {results.map((r) => (
                    <li key={r.videoId}>
                      <button
                        type="button"
                        onClick={() => pickVideo(r.videoId, splitYouTubeTitle(r.title, r.channel))}
                        className={cn(
                          "flex w-full items-center gap-3 p-2 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                          r.videoId === videoId && "bg-butter/40",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.channel}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {r.durationMs != null ? formatMs(r.durationMs).replace(/\.\d$/, "") : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end border-t p-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setResults(null)}>
                  Close results
                </Button>
              </div>
            </div>
          )}
          {videoId && (
            <YouTubeSegmentEditor
              key={videoId}
              videoId={videoId}
              startMs={startMs}
              endMs={endMs}
              defaultLengthMs={defaultLengthMs}
              volume={volume}
              onChange={setSegment}
              onError={setError}
              onMeta={({ title: rawTitle, author }) => {
                if (!rawTitle) return;
                const guess = splitYouTubeTitle(rawTitle, author);
                setTitle((t) => t || guess.title);
                setArtist((a) => a || guess.artist);
              }}
            />
          )}
        </div>
      )}

      {/* Details */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="track-title">Song title</Label>
          <Input
            id="track-title"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="track-artist">Artist</Label>
          <Input
            id="track-artist"
            value={artist}
            maxLength={200}
            onChange={(e) => {
              setArtist(e.target.value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      {hasAudio && (
        <div className="flex flex-wrap items-end gap-5">
          <TimeField id="seg-start" label="Start" valueMs={startMs} onCommit={(ms) => setSegment(ms, endMs != null && endMs > ms ? endMs : ms + defaultLengthMs)} />
          <TimeField
            id="seg-end"
            label="End"
            valueMs={endMs}
            onCommit={(ms) => {
              if (ms <= startMs) setError("The end must be after the start.");
              else setSegment(startMs, ms);
            }}
          />
          <p className="pb-2 text-sm text-muted-foreground">
            Length {endMs != null ? formatMs(endMs - startMs) : "â€“"}
          </p>
          <div className="grid min-w-[12rem] flex-1 gap-1.5">
            <Label htmlFor="volume" className="flex items-center gap-1.5">
              <Volume2 className="h-4 w-4" /> Volume {Math.round(volume * 100)}%
            </Label>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setSaved(false);
              }}
              className="h-9 accent-jaffa"
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="button" onClick={save} disabled={saving || !hasAudio}>
          {saving ? "Savingâ€¦" : "Save music"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/journal/${entryId}`}>Back to memory</Link>
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
        {track && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            <Trash2 /> Remove music
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove the music?"
        description="This photo or video will no longer play a song. Any uploaded audio file and its lyrics will be deleted."
        confirmLabel="Remove music"
        pendingLabel="Removingâ€¦"
        pending={deleting}
        error={deleteError}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={removeTrack}
      />
    </div>
  );
}
