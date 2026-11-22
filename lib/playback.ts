// Browser-only: import from Client Components.
import { loadYouTubeApi, youTubeErrorMessage, type YTPlayer } from "@/lib/youtube";

/**
 * One interface for "the song that plays with a photo/video", whatever the source.
 * The underlying player is always the source of truth for time.
 */
export interface PlaybackClock {
  play(): Promise<boolean>; // false if the browser blocked playback
  pause(): void;
  seek(ms: number): void;
  getTimeMs(): number;
  getDurationMs(): number | null;
  isPlaying(): boolean;
  setVolume(volume: number): void; // 0..1 (ignored by iOS for <audio>)
  /** YouTube only: true while playing muted because sound was blocked. */
  isMutedFallback?(): boolean;
  /** YouTube only: try to turn the sound on (call from a tap). */
  unmute?(): void;
  destroy(): void;
}

export type ClockEvents = {
  onReady?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (message: string) => void;
};

// ---------------------------------------------------------------------------
// Mobile autoplay: phones only allow sound that starts inside a tap. Songs load
// after the tap, so we "unlock" ONE shared <audio> element during the tap and
// reuse it for every uploaded song afterwards (an unlocked element stays unlocked).
// ---------------------------------------------------------------------------

/** 44-byte silent WAV. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;

function getSharedAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    sharedAudio.setAttribute("playsinline", "");
  }
  return sharedAudio;
}

/** Call synchronously inside a tap/click/key handler (e.g. opening the viewer). */
export function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  const audio = getSharedAudio();
  if (audio.src && audio.src !== SILENT_WAV) {
    unlocked = true; // already in use for a real song
    return;
  }
  audio.src = SILENT_WAV;
  const attempt = audio.play();
  unlocked = true;
  attempt
    ?.then(() => {
      if (audio.src === SILENT_WAV) audio.pause();
    })
    .catch(() => {
      unlocked = false;
    });
}

/** Uploaded audio → the shared HTMLAudioElement. */
export function createAudioClock(url: string, events: ClockEvents = {}): PlaybackClock {
  const audio = getSharedAudio();
  const listeners = new AbortController();
  const on = (type: string, fn: () => void) => audio.addEventListener(type, fn, { signal: listeners.signal });

  on("loadedmetadata", () => events.onReady?.());
  on("play", () => events.onPlayingChange?.(true));
  on("pause", () => events.onPlayingChange?.(false));
  on("error", () => {
    if (audio.src !== SILENT_WAV) events.onError?.("Couldn't load the audio file.");
  });
  audio.pause();
  audio.src = url;
  audio.load();

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
      listeners.abort();
      audio.pause();
      // Keep the element (it stays unlocked); just drop the song.
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
  let mutedFallback = false;
  let volume = 1;
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
            player?.setVolume(Math.round(volume * 100));
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

  const waitForPlaying = () => new Promise((r) => setTimeout(r, 1200)).then(() => playing);

  return {
    async play() {
      if (!ready || !player) return false;
      if (!mutedFallback) player.unMute?.();
      player.playVideo();
      // YouTube gives no promise; if it isn't playing shortly after, sound was blocked.
      if (await waitForPlaying()) return true;
      // Phones (iPhone especially) block unmuted iframe playback: start muted instead,
      // so the video, timer and lyrics run, and let the person tap to unmute.
      if (destroyed || !player) return false;
      mutedFallback = true;
      player.mute?.();
      player.playVideo();
      await waitForPlaying();
      return false;
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
      volume = v;
      if (ready) player?.setVolume(Math.round(v * 100));
    },
    isMutedFallback: () => mutedFallback,
    unmute: () => {
      if (!player) return;
      player.unMute?.();
      player.setVolume(Math.round(volume * 100));
      if (!playing) player.playVideo();
      mutedFallback = Boolean(player.isMuted?.());
    },
    destroy: () => {
      destroyed = true;
      player?.destroy();
      host.replaceChildren();
    },
  };
}
