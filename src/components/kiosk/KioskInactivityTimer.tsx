import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleStillHere}
          onTouchStart={handleStillHere}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-card rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl font-bold text-foreground mb-4">
              {t("kiosk.inactivity.still_here")}
            </p>
            <p className="text-muted-foreground mb-6">
              {t("kiosk.inactivity.reset_warning").replace("{seconds}", String(countdown))}
            </p>
            <button
              onClick={handleStillHere}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-bold"
            >
              {t("kiosk.inactivity.continue")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
