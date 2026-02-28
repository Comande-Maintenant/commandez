import { useRef, useState, useCallback, useEffect } from "react";

const VOLUME_KEY = "dashboard-notification-volume";
const MUTED_KEY = "dashboard-notification-muted";

function getStoredVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    return v !== null ? Number(v) : 70;
  } catch {
    return 70;
  }
}

function getStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

// Generate a "cash register" ding-ding sound using Web Audio API
function playDingDing(ctx: AudioContext, volume: number) {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, ctx.currentTime);

  const vol = (volume / 100) * 0.6; // Scale to reasonable level

  // First ding
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(1800, ctx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
  osc1.connect(gain);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.15);

  // Second ding (higher pitch, slight delay)
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(0, ctx.currentTime);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(2200, ctx.currentTime + 0.12);
  osc2.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.2);
  osc2.connect(gain2);
  gain2.gain.setValueAtTime(vol, ctx.currentTime + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc2.start(ctx.currentTime + 0.12);
  osc2.stop(ctx.currentTime + 0.35);

  // Third ding (highest, completes the cash register feel)
  const gain3 = ctx.createGain();
  gain3.connect(ctx.destination);
  gain3.gain.setValueAtTime(0, ctx.currentTime);

  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(2600, ctx.currentTime + 0.28);
  osc3.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.36);
  osc3.connect(gain3);
  gain3.gain.setValueAtTime(vol * 0.8, ctx.currentTime + 0.28);
  gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  osc3.start(ctx.currentTime + 0.28);
  osc3.stop(ctx.currentTime + 0.55);
}

export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [volume, setVolumeState] = useState(getStoredVolume);
  const [muted, setMutedState] = useState(getStoredMuted);

  // Try to resume existing context on mount
  useEffect(() => {
    if (ctxRef.current && ctxRef.current.state === "running") {
      setAudioUnlocked(true);
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().then(() => setAudioUnlocked(true));
    } else {
      setAudioUnlocked(true);
    }
    // Play a silent buffer to fully unlock on iOS/Safari
    const buf = ctxRef.current.createBuffer(1, 1, 22050);
    const src = ctxRef.current.createBufferSource();
    src.buffer = buf;
    src.connect(ctxRef.current.destination);
    src.start(0);
  }, []);

  const play = useCallback(() => {
    if (muted || !ctxRef.current || ctxRef.current.state !== "running") return;
    playDingDing(ctxRef.current, volume);
  }, [muted, volume]);

  const testPlay = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().then(() => {
        setAudioUnlocked(true);
        playDingDing(ctxRef.current!, volume);
      });
    } else {
      setAudioUnlocked(true);
      playDingDing(ctxRef.current, volume);
    }
  }, [volume]);

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

  return {
    audioUnlocked,
    unlockAudio,
    play,
    testPlay,
    volume,
    setVolume,
    muted,
    setMuted,
    toggleMuted,
  };
}
