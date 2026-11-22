export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a bare ID or youtube.com / youtu.be / music.youtube.com / shorts / embed links. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (YOUTUBE_ID_RE.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

// ---- Minimal typings for the YouTube IFrame Player API ----

export type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  getPlayerState(): number;
  getVideoData?: () => { title?: string; author?: string };
  destroy(): void;
};

type YTPlayerOptions = {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
    onStateChange?: (e: { data: number }) => void;
  };
};

export type YTNamespace = {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Couldn't load the YouTube player."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** IFrame API error codes → something a person can act on. */
export function youTubeErrorMessage(code: number) {
  if (code === 101 || code === 150 || code === 153) {
    return "The owner of this video doesn't allow it to play on other sites. Upload the song as an audio file instead.";
  }
  if (code === 100) return "This video was removed or is private.";
  if (code === 2) return "That doesn't look like a valid YouTube video.";
  return "This video can't be played here.";
}
