import { cacheLife } from "next/cache";

/**
 * Server-only. Uses YOUTUBE_API_KEY (never NEXT_PUBLIC_), so the key stays off the client.
 * Quota: search.list = 100 units + videos.list = 1 unit per search (10,000 units/day free).
 */

export type SongResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationMs: number | null;
};

const API = "https://www.googleapis.com/youtube/v3";

export function youTubeSearchConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/** The Data API returns HTML-escaped titles ("Don&#39;t Stop"). */
function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** ISO 8601 "PT3M45S" → 225000 */
function parseIsoDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h = "0", min = "0", s = "0"] = m;
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000;
}

type SearchResponse = {
  items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }[];
  error?: { message: string };
};
type VideosResponse = {
  items?: { id: string; contentDetails?: { duration?: string } }[];
};

type SnippetResponse = {
  items?: { snippet?: { channelId?: string; thumbnails?: Record<string, { url: string }> } }[];
  error?: { message: string };
};

/**
 * Profile photo of the channel that uploaded `videoId` (2 quota units).
 * Throws on API errors so failures aren't cached; returns null if the video/channel has none.
 */
export async function fetchChannelAvatar(videoId: string): Promise<string | null> {
  "use cache";
  cacheLife("days");

  const key = process.env.YOUTUBE_API_KEY!;
  const vres = await fetch(`${API}/videos?${new URLSearchParams({ part: "snippet", id: videoId, key })}`);
  const vdata = (await vres.json()) as SnippetResponse;
  if (!vres.ok) throw new Error(vdata.error?.message ?? "YouTube lookup failed.");
  const channelId = vdata.items?.[0]?.snippet?.channelId;
  if (!channelId) return null;

  const cres = await fetch(`${API}/channels?${new URLSearchParams({ part: "snippet", id: channelId, key })}`);
  const cdata = (await cres.json()) as SnippetResponse;
  if (!cres.ok) throw new Error(cdata.error?.message ?? "YouTube lookup failed.");
  const t = cdata.items?.[0]?.snippet?.thumbnails;
  const url = (t?.medium ?? t?.high ?? t?.default)?.url ?? null;
  return url?.startsWith("https://") ? url : null;
}

/** Same as fetchChannelAvatar, but never throws (null when unavailable or not configured). */
export async function channelAvatarOrNull(videoId: string): Promise<string | null> {
  if (!youTubeSearchConfigured()) return null;
  try {
    return await fetchChannelAvatar(videoId);
  } catch {
    return null;
  }
}

/** Cached per query for a few hours so repeated searches don't spend quota. Throws on API errors (not cached). */
export async function searchSongs(query: string): Promise<SongResult[]> {
  "use cache";
  cacheLife("hours");

  const key = process.env.YOUTUBE_API_KEY!;
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10", // Music
    videoEmbeddable: "true", // only videos that can play inside the app
    maxResults: "12",
    key,
  });

  const res = await fetch(`${API}/search?${params}`);
  const data = (await res.json()) as SearchResponse;
  if (!res.ok) throw new Error(data.error?.message ?? `YouTube search failed (${res.status}).`);

  const items = (data.items ?? []).filter((i) => i.id.videoId);
  if (items.length === 0) return [];

  // One extra unit to get durations for all results.
  const ids = items.map((i) => i.id.videoId!).join(",");
  const durations = new Map<string, number | null>();
  const vres = await fetch(`${API}/videos?${new URLSearchParams({ part: "contentDetails", id: ids, key })}`);
  if (vres.ok) {
    const vdata = (await vres.json()) as VideosResponse;
    for (const v of vdata.items ?? []) durations.set(v.id, parseIsoDuration(v.contentDetails?.duration));
  }

  return items.map((i) => {
    const t = i.snippet.thumbnails;
    return {
      videoId: i.id.videoId!,
      title: decodeEntities(i.snippet.title),
      channel: decodeEntities(i.snippet.channelTitle),
      thumbnail: (t.medium ?? t.default ?? Object.values(t)[0])?.url ?? "",
      durationMs: durations.get(i.id.videoId!) ?? null,
    };
  });
}
