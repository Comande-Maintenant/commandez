import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  orderNumber: string;
  paymentMethod: string;
  onReset: () => void;
}

const AUTO_RESET_SECONDS = 10;

export const KioskConfirmation = ({ orderNumber, paymentMethod, onReset }: Props) => {
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onReset]);

  const isCounter = paymentMethod === "cash" || paymentMethod === "counter";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 text-center px-8"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center"
        >
          <Check className="h-12 w-12 text-emerald-600" strokeWidth={3} />
        </motion.div>

        {/* Order number */}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t("kiosk.confirmation.title")}
          </h1>
          <p className="text-7xl sm:text-8xl font-black text-primary tracking-tight">
            {orderNumber}
          </p>
        </div>

        {/* Payment instruction */}
        <p className="text-xl text-muted-foreground max-w-md">
          {isCounter
            ? t("kiosk.confirmation.pay_counter")
            : t("kiosk.confirmation.paid")}
        </p>

        {/* New order button */}
        <button
          onClick={onReset}
          className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-bold shadow-lg hover:opacity-90 transition-opacity"
        >
          {t("kiosk.confirmation.new_order")}
        </button>

        {/* Countdown */}
        <p className="text-sm text-muted-foreground">
          {t("kiosk.inactivity.reset_warning").replace("{seconds}", String(countdown))}
        </p>
      </motion.div>
    </div>
  );
};
