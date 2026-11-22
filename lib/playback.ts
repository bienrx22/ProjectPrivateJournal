// Browser-only: import from Client Components.
import { loadYouTubeApi, youTubeErrorMessage, type YTPlayer } from "@/lib/youtube";

/**
 * One interface for "the song that plays with a photo/video", whatever the source.
 * The underlying player is always the source of truth for time.
 */
export interface PlaybackClock {
  play(): Promise<boolean>; // false if the browser blocked autoplay
  pause(): void;
  seek(ms: number): void;
  getTimeMs(): number;
  getDurationMs(): number | null;
  isPlaying(): boolean;
  setVolume(volume: number): void; // 0..1
  destroy(): void;
}

export type ClockEvents = {
  onReady?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (message: string) => void;
};

/** Uploaded audio → HTMLAudioElement. */
export function createAudioClock(url: string, events: ClockEvents = {}): PlaybackClock {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;
  audio.addEventListener("loadedmetadata", () => events.onReady?.());
  audio.addEventListener("play", () => events.onPlayingChange?.(true));
  audio.addEventListener("pause", () => events.onPlayingChange?.(false));
  audio.addEventListener("error", () => events.onError?.("Couldn't load the audio file."));

  return {
    async play() {
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    pause: () => audio.pause(),
    seek: (ms) => {
      audio.currentTime = ms / 1000;
    },
    getTimeMs: () => audio.currentTime * 1000,
    getDurationMs: () => (Number.isFinite(audio.duration) ? audio.duration * 1000 : null),
    isPlaying: () => !audio.paused,
    setVolume: (v) => {
      audio.volume = Math.min(1, Math.max(0, v));
    },
    destroy: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

/** YouTube → IFrame player mounted (visibly) inside `host`. */
export function createYouTubeClock(
  host: HTMLElement,
  videoId: string,
  startMs: number,
  events: ClockEvents = {},
): PlaybackClock {
  let player: YTPlayer | null = null;
  let ready = false;
  let destroyed = false;
  let playing = false;
  let pendingVolume = 1;
  const mount = document.createElement("div");
  host.appendChild(mount);

  loadYouTubeApi()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 0, start: Math.floor(startMs / 1000) },
        events: {
          onReady: () => {
            ready = true;
            player?.setVolume(Math.round(pendingVolume * 100));
            events.onReady?.();
          },
          onStateChange: ({ data }) => {
            const now = data === YT.PlayerState.PLAYING;
            if (now !== playing) {
              playing = now;
              events.onPlayingChange?.(now);
            }
          },
          onError: ({ data }) => events.onError?.(youTubeErrorMessage(data)),
        },
      });
    })
    .catch((err: Error) => events.onError?.(err.message));

  return {
    async play() {
      if (!ready || !player) return false;
      player.playVideo();
      // YouTube gives no promise; if it isn't playing shortly after, autoplay was blocked.
      await new Promise((r) => setTimeout(r, 1200));
      return playing;
    },
    pause: () => player?.pauseVideo(),
    seek: (ms) => player?.seekTo(ms / 1000, true),
    getTimeMs: () => (ready && player ? player.getCurrentTime() * 1000 : startMs),
    getDurationMs: () => {
      const d = ready && player ? player.getDuration() : 0;
      return d > 0 ? d * 1000 : null;
    },
    isPlaying: () => playing,
    setVolume: (v) => {
      pendingVolume = v;
      if (ready) player?.setVolume(Math.round(v * 100));
    },
    destroy: () => {
      destroyed = true;
      player?.destroy();
      host.replaceChildren();
    },
  };
}
