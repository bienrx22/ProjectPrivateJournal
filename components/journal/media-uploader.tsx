"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { addMedia } from "@/app/(main)/journal/media-actions";
import { ACCEPT_MEDIA, MAX_MEDIA_BYTES, MEDIA_BUCKET, mediaTypeFor } from "@/lib/media";
import { cn } from "@/lib/utils";

type Status = "queued" | "uploading" | "done" | "error";
type Job = { key: string; name: string; status: Status; message?: string };

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin";
}

function videoDurationMs(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

export function MediaUploader({ entryId, userId }: { entryId: string; userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = jobs.some((j) => j.status === "queued" || j.status === "uploading");

  const update = (key: string, patch: Partial<Job>) =>
    setJobs((all) => all.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  async function uploadAll(files: File[]) {
    if (!files.length || busy) return;
    const batch = files.map((file) => ({ file, key: crypto.randomUUID() }));
    setJobs(batch.map(({ file, key }) => ({ key, name: file.name, status: "queued" })));

    const supabase = createClient();
    // One at a time: keeps sort order matching the selection and memory use low.
    for (const { file, key } of batch) {
      const mediaType = mediaTypeFor(file.type);
      if (!mediaType) {
        update(key, { status: "error", message: "Unsupported type (use JPG, PNG, WebP, GIF, MP4, MOV or WebM)" });
        continue;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        update(key, { status: "error", message: "Larger than 50 MB" });
        continue;
      }

      update(key, { status: "uploading" });
      const path = `${userId}/${entryId}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const durationMs = mediaType === "VIDEO" ? await videoDurationMs(file) : null;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        update(key, { status: "error", message: uploadError.message });
        continue;
      }

      const result = await addMedia(entryId, { path, mimeType: file.type, size: file.size, durationMs });
      update(key, result.error ? { status: "error", message: result.error } : { status: "done" });
    }
  }

  const doneCount = jobs.filter((j) => j.status === "done").length;

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadAll(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors",
          dragging && "border-jaffa bg-butter/30",
        )}
      >
        <ImagePlus className="h-6 w-6" />
        <p>Drag photos and videos here, or</p>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {busy ? `Uploading ${doneCount + 1} of ${jobs.length}…` : "Add photos & videos"}
        </Button>
        <p className="text-xs">JPG, PNG, WebP, GIF, MP4, MOV, WebM · up to 50 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_MEDIA}
          className="hidden"
          onChange={(e) => {
            uploadAll(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.key} className="flex items-center gap-2">
              {j.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />}
              {j.status === "error" && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
              {(j.status === "uploading" || j.status === "queued") && (
                <Loader2 className={cn("h-4 w-4 shrink-0", j.status === "uploading" && "animate-spin")} />
              )}
              <span className="truncate">{j.name}</span>
              {j.message && <span className="text-xs text-destructive">— {j.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
