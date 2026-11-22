import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ month?: string }>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_DAY = 3;

export default function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section>
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-xl bg-muted/60" />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Today" in the visitor's timezone (Vercel sends it as a header; locally, the machine's zone). */
async function todayString() {
  const tz = (await headers()).get("x-vercel-ip-timezone") ?? undefined;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(new Date());
  }
}

async function Calendar({ searchParams }: { searchParams: SearchParams }) {
  const [{ month: monthParam }, today] = await Promise.all([searchParams, todayString()]);

  const valid = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam);
  const [year, month] = (valid ? monthParam : today.slice(0, 7)).split("-").map(Number);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("journal_entries")
    .select("id, title, entry_date, is_favorite")
    .gte("entry_date", first)
    .lte("entry_date", last)
    .order("entry_date")
    .order("created_at");
  if (error) throw new Error(error.message);

  const byDay = new Map<string, typeof entries>();
  for (const e of entries) byDay.set(e.entry_date, [...(byDay.get(e.entry_date) ?? []), e]);

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">{label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length === 0
              ? "No memories this month."
              : `${entries.length} ${entries.length === 1 ? "memory" : "memories"} this month`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Previous month">
            <Link href={`/calendar?month=${prev}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Today</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Next month">
            <Link href={`/calendar?month=${next}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} className="min-h-16 border-b border-r bg-muted/20 sm:min-h-28" />;
            const dayEntries = byDay.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={date}
                className={cn(
                  "group relative flex min-h-16 flex-col gap-1 border-b border-r p-1.5 sm:min-h-28 sm:p-2",
                  dayEntries.length > 0 && "bg-butter/15",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday ? "bg-jaffa font-semibold text-white" : "text-muted-foreground",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <Link
                    href={`/journal/new?date=${date}`}
                    aria-label={`New memory on ${date}`}
                    className="hidden h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Phones: dots. Larger screens: titles. */}
                {dayEntries.length > 0 && (
                  <Link
                    href={dayEntries.length === 1 ? `/journal/${dayEntries[0].id}` : `/dashboard?from=${date}&to=${date}`}
                    className="flex flex-wrap gap-1 sm:hidden"
                    aria-label={`${dayEntries.length} ${dayEntries.length === 1 ? "memory" : "memories"} on ${date}`}
                  >
                    {dayEntries.slice(0, 4).map((e) => (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-jaffa" />
                    ))}
                  </Link>
                )}
                <ul className="hidden flex-col gap-1 sm:flex">
                  {dayEntries.slice(0, MAX_PER_DAY).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/journal/${e.id}`}
                        className="flex items-center gap-1 truncate rounded-md bg-butter/70 px-1.5 py-0.5 text-xs text-foreground transition hover:bg-butter"
                        title={e.title}
                      >
                        {e.is_favorite && <Star className="h-3 w-3 shrink-0 fill-jaffa text-jaffa" />}
                        <span className="truncate">{e.title}</span>
                      </Link>
                    </li>
                  ))}
                  {dayEntries.length > MAX_PER_DAY && (
                    <li>
                      <Link
                        href={`/dashboard?from=${date}&to=${date}`}
                        className="px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        +{dayEntries.length - MAX_PER_DAY} more
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
