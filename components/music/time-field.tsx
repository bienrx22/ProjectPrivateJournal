"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMs, parseTime } from "@/lib/music";
import { cn } from "@/lib/utils";

/** "m:ss.s" text field; commits on blur/Enter, reverts if unreadable. */
export function TimeField({
  id,
  label,
  valueMs,
  onCommit,
  className,
}: {
  id: string;
  label?: string;
  valueMs: number | null;
  onCommit: (ms: number) => void;
  className?: string;
}) {
  const input = (
    <Input
      key={valueMs ?? "none"}
      id={id}
      inputMode="decimal"
      aria-label={label ? undefined : "Time"}
      defaultValue={valueMs == null ? "" : formatMs(valueMs)}
      placeholder="0:00.0"
      className={cn("w-28 tabular-nums", className)}
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
  );
  if (!label) return input;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
    </div>
  );
}
