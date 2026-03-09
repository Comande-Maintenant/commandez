import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  timeoutSeconds: number;
  onReset: () => void;
  /** Disable the timer (e.g. when on splash screen) */
  disabled?: boolean;
}

const WARNING_SECONDS = 15;

export const KioskInactivityTimer = ({ timeoutSeconds, onReset, disabled }: Props) => {
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (disabled) return;
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            onReset();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeoutSeconds * 1000);
  }, [timeoutSeconds, onReset, disabled]);

  // Listen for user activity
  useEffect(() => {
    if (disabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    const events = ["touchstart", "mousedown", "mousemove", "keydown", "scroll"];
    const handler = () => resetTimer();

    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimer, disabled]);

  const handleStillHere = () => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    resetTimer();
  };

  if (!showWarning) return null;

  return (
    <div
      onClick={handleStillHere}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
          textAlign: "center",
          maxWidth: "360px",
          width: "calc(100% - 48px)",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#111827",
            marginBottom: "16px",
            margin: "0 0 16px 0",
          }}
        >
          {t("kiosk.inactivity.still_here")}
        </p>
        <p
          style={{
            fontSize: "16px",
            color: "#6B7280",
            marginBottom: "24px",
            margin: "0 0 24px 0",
          }}
        >
          {t("kiosk.inactivity.reset_warning").replace("{seconds}", String(countdown))}
        </p>
        <button
          onClick={handleStillHere}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            backgroundColor: "hsl(var(--primary, 160 84% 39%))",
            color: "#ffffff",
            fontSize: "18px",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {t("kiosk.inactivity.continue")}
        </button>
      </div>
    </div>
  );
};
