import { useRef, useState, useCallback, useEffect } from "react";

// ── Storage keys ──
const VOLUME_KEY = "dashboard-notification-volume";
const MUTED_KEY = "dashboard-notification-muted";
const REPEAT_KEY = "dashboard-notification-repeat";

function getStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (typeof fallback === "number" ? Number(v) as unknown as T : typeof fallback === "boolean" ? (v === "true") as unknown as T : v as unknown as T) : fallback;
  } catch { return fallback; }
}

// ── Fully Kiosk Browser detection ──
declare global {
  interface Window {
    fully?: {
      playSound: (url: string, loop?: boolean) => void;
      stopSound: () => void;
      getDeviceId: () => string;
    };
  }
}

function isFullyKiosk(): boolean {
  return typeof window.fully?.playSound === "function";
}

// ── Visual fallback: title blink ──
let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
const originalTitle = typeof document !== "undefined" ? document.title : "";

function startTitleBlink(message: string) {
  stopTitleBlink();
  let on = true;
  titleBlinkInterval = setInterval(() => {
    document.title = on ? message : originalTitle;
    on = !on;
  }, 1000);
  setTimeout(stopTitleBlink, 30000);
}

function stopTitleBlink() {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
    document.title = originalTitle;
  }
}

// ── Main hook ──

const REPEAT_INTERVAL_MS = 30_000;
const MAX_REPEATS = 5;
const KACHING_PATH = "/sounds/kaching.mp3";

export type SoundType = "classic" | "urgent" | "soft";

export interface SoundControls {
  audioUnlocked: boolean;
  unlockAudio: () => void;
  play: () => void;
  testPlay: () => void;
  stopRepeat: () => void;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;
  soundType: SoundType;
  setSoundType: (t: SoundType) => void;
  repeatEnabled: boolean;
  setRepeatEnabled: (r: boolean) => void;
  isRepeating: boolean;
}

export function useNotificationSound(): SoundControls {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [volume, setVolumeState] = useState(() => getStored(VOLUME_KEY, 70));
  const [muted, setMutedState] = useState(() => getStored(MUTED_KEY, false));
  const [soundType, setSoundTypeState] = useState<SoundType>("classic");
  const [repeatEnabled, setRepeatEnabledState] = useState(() => getStored(REPEAT_KEY, true));
  const [isRepeating, setIsRepeating] = useState(false);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatCountRef = useRef(0);

  // Refs for use in callbacks
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const repeatEnabledRef = useRef(repeatEnabled);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { repeatEnabledRef.current = repeatEnabled; }, [repeatEnabled]);

  // Preload kaching MP3
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(KACHING_PATH);
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;
  }, []);

  // Stop title blink on user activity
  useEffect(() => {
    const handler = () => stopTitleBlink();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioRef.current) {
      // Play silent (volume 0) to unlock audio on iOS/Safari/Chrome
      const a = audioRef.current;
      const prevVol = a.volume;
      a.volume = 0;
      a.currentTime = 0;
      a.play().then(() => {
        a.pause();
        a.volume = prevVol;
        a.currentTime = 0;
        setAudioUnlocked(true);
      }).catch(() => {
        a.volume = prevVol;
      });
    }
  }, []);

  const playOnce = useCallback(() => {
    const vol = volumeRef.current / 100;

    // Layer 1: Fully Kiosk Browser native sound
    if (isFullyKiosk()) {
      try {
        window.fully!.playSound("content://settings/system/notification_sound", false);
        return;
      } catch {}
    }

    // Layer 2: HTML Audio (kaching.mp3) - most reliable
    if (audioRef.current) {
      const a = audioRef.current;
      a.volume = vol;
      a.currentTime = 0;
      a.play().then(() => {
        setAudioUnlocked(true);
      }).catch(() => {
        // Audio blocked - try cloning (some browsers need fresh elements)
        try {
          const clone = new Audio(KACHING_PATH);
          clone.volume = vol;
          clone.play().catch(() => {});
        } catch {}
      });
    }
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current) {
      clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
    repeatCountRef.current = 0;
    setIsRepeating(false);
    stopTitleBlink();
  }, []);

  const play = useCallback(() => {
    if (mutedRef.current) return;

    playOnce();

    // Title blink if tab not focused
    if (document.hidden) {
      startTitleBlink("Nouvelle commande !");
    }

    // Repeat logic: ring again every 30s if no interaction
    stopRepeat();
    if (repeatEnabledRef.current) {
      setIsRepeating(true);
      repeatCountRef.current = 0;
      repeatRef.current = setInterval(() => {
        repeatCountRef.current += 1;
        if (repeatCountRef.current >= MAX_REPEATS) {
          stopRepeat();
          return;
        }
        playOnce();
      }, REPEAT_INTERVAL_MS);
    }
  }, [playOnce, stopRepeat]);

  // Stop repeat on any user interaction
  useEffect(() => {
    const handler = () => {
      if (repeatRef.current) stopRepeat();
    };
    const events = ["mousedown", "touchstart", "keydown"];
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      stopRepeat();
    };
  }, [stopRepeat]);

  const testPlay = useCallback(() => {
    if (audioRef.current) {
      const a = audioRef.current;
      a.volume = volumeRef.current / 100;
      a.currentTime = 0;
      a.play().then(() => setAudioUnlocked(true)).catch(() => {});
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    localStorage.setItem(MUTED_KEY, String(m));
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      localStorage.setItem(MUTED_KEY, String(next));
      return next;
    });
  }, []);

  const setSoundType = useCallback((t: SoundType) => {
    setSoundTypeState(t);
  }, []);

  const setRepeatEnabled = useCallback((r: boolean) => {
    setRepeatEnabledState(r);
    localStorage.setItem(REPEAT_KEY, String(r));
  }, []);

  return {
    audioUnlocked,
    unlockAudio,
    play,
    testPlay,
    stopRepeat,
    volume,
    setVolume,
    muted,
    setMuted,
    toggleMuted,
    soundType,
    setSoundType,
    repeatEnabled,
    setRepeatEnabled,
    isRepeating,
  };
}
