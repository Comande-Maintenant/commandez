import { useRef, useState, useCallback, useEffect } from "react";

// ── Storage keys ──
const VOLUME_KEY = "dashboard-notification-volume";
const MUTED_KEY = "dashboard-notification-muted";
const SOUND_TYPE_KEY = "dashboard-notification-sound-type";
const REPEAT_KEY = "dashboard-notification-repeat";

export type SoundType = "classic" | "urgent" | "soft";

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

// ── Sound generators (Web Audio API) ──

function playClassic(ctx: AudioContext, vol: number) {
  // Cash register ding-ding-ding (3 notes ascending)
  const notes = [
    { freq: 1800, end: 1200, start: 0, dur: 0.15 },
    { freq: 2200, end: 1600, start: 0.12, dur: 0.23 },
    { freq: 2600, end: 2000, start: 0.28, dur: 0.27 },
  ];
  for (const n of notes) {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);
    osc.frequency.exponentialRampToValueAtTime(n.end, ctx.currentTime + n.start + n.dur * 0.6);
    osc.connect(gain);
    gain.gain.setValueAtTime(vol, ctx.currentTime + n.start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
    osc.start(ctx.currentTime + n.start);
    osc.stop(ctx.currentTime + n.start + n.dur);
  }
}

function playUrgent(ctx: AudioContext, vol: number) {
  // Rapid alert beeps: 3 short high-pitch bursts
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.18;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(1400, t);
    osc.connect(gain);
    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.setValueAtTime(vol * 0.5, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  }
  // Final long tone
  const t2 = ctx.currentTime + 0.56;
  const g2 = ctx.createGain();
  g2.connect(ctx.destination);
  const o2 = ctx.createOscillator();
  o2.type = "square";
  o2.frequency.setValueAtTime(1800, t2);
  o2.frequency.exponentialRampToValueAtTime(1200, t2 + 0.3);
  o2.connect(g2);
  g2.gain.setValueAtTime(vol * 0.4, t2);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.3);
  o2.start(t2);
  o2.stop(t2 + 0.3);
}

function playSoft(ctx: AudioContext, vol: number) {
  // Gentle two-tone chime (triangle wave, warm)
  const notes = [
    { freq: 880, start: 0, dur: 0.35 },
    { freq: 1320, start: 0.25, dur: 0.45 },
  ];
  for (const n of notes) {
    const t = ctx.currentTime + n.start;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.freq, t);
    osc.connect(gain);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.7, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
    osc.start(t);
    osc.stop(t + n.dur);
  }
}

const SOUND_PLAYERS: Record<SoundType, (ctx: AudioContext, vol: number) => void> = {
  classic: playClassic,
  urgent: playUrgent,
  soft: playSoft,
};

// ── Visual fallback: screen flash ──
function flashScreen() {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(16,185,129,0.25);pointer-events:none;transition:opacity 0.5s";
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "0";
  });
  setTimeout(() => el.remove(), 600);
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
  // Stop after 30s to avoid infinite blink
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
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [volume, setVolumeState] = useState(() => getStored(VOLUME_KEY, 70));
  const [muted, setMutedState] = useState(() => getStored(MUTED_KEY, false));
  const [soundType, setSoundTypeState] = useState<SoundType>(() => getStored(SOUND_TYPE_KEY, "classic" as SoundType));
  const [repeatEnabled, setRepeatEnabledState] = useState(() => getStored(REPEAT_KEY, true));
  const [isRepeating, setIsRepeating] = useState(false);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatCountRef = useRef(0);

  // Keep refs in sync for use in callbacks
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const soundTypeRef = useRef(soundType);
  const repeatEnabledRef = useRef(repeatEnabled);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);
  useEffect(() => { repeatEnabledRef.current = repeatEnabled; }, [repeatEnabled]);

  // Try to detect existing running context on mount
  useEffect(() => {
    if (ctxRef.current && ctxRef.current.state === "running") {
      setAudioUnlocked(true);
    }
  }, []);

  // Stop title blink on user activity
  useEffect(() => {
    const handler = () => stopTitleBlink();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const getOrCreateCtx = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const unlockAudio = useCallback(() => {
    const ctx = getOrCreateCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => setAudioUnlocked(true)).catch(() => {});
    } else {
      setAudioUnlocked(true);
    }
    // Silent buffer trick for iOS/Safari
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  }, [getOrCreateCtx]);

  const playOnce = useCallback(() => {
    const vol = (volumeRef.current / 100) * 0.6;

    // Layer 1: Fully Kiosk Browser native sound
    if (isFullyKiosk()) {
      try {
        // Use a data URI beep as Fully Kiosk can play URLs
        window.fully!.playSound("content://settings/system/notification_sound", false);
        return;
      } catch {}
    }

    // Layer 2: Web Audio API
    const ctx = getOrCreateCtx();
    if (ctx && ctx.state === "running") {
      try {
        SOUND_PLAYERS[soundTypeRef.current](ctx, vol);
        return;
      } catch {}
    }

    // Layer 3: Resume suspended context and retry
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => {
        setAudioUnlocked(true);
        try {
          SOUND_PLAYERS[soundTypeRef.current](ctx, vol);
        } catch {}
      }).catch(() => {});
      return;
    }

    // Layer 4: Visual fallback
    flashScreen();
  }, [getOrCreateCtx]);

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

    // Play the sound immediately
    playOnce();

    // Visual: flash screen
    flashScreen();

    // Visual: title blink if tab not focused
    if (document.hidden) {
      startTitleBlink("🔔 Nouvelle commande !");
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
        flashScreen();
      }, REPEAT_INTERVAL_MS);
    }
  }, [playOnce, stopRepeat]);

  // Stop repeat on any user interaction (they saw the notification)
  useEffect(() => {
    const handler = () => {
      if (repeatRef.current) {
        stopRepeat();
      }
    };
    const events = ["mousedown", "touchstart", "keydown"];
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      stopRepeat();
    };
  }, [stopRepeat]);

  const testPlay = useCallback(() => {
    const ctx = getOrCreateCtx();
    if (!ctx) {
      flashScreen();
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        setAudioUnlocked(true);
        const vol = (volumeRef.current / 100) * 0.6;
        SOUND_PLAYERS[soundTypeRef.current](ctx, vol);
      }).catch(() => flashScreen());
    } else {
      setAudioUnlocked(true);
      const vol = (volumeRef.current / 100) * 0.6;
      SOUND_PLAYERS[soundTypeRef.current](ctx, vol);
    }
  }, [getOrCreateCtx]);

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
    localStorage.setItem(SOUND_TYPE_KEY, t);
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
