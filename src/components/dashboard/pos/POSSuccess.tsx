import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  displayNumber: string;
  onReset: () => void;
}

export const POSSuccess = ({ displayNumber, onReset }: Props) => {
  const { t } = useLanguage();
  useEffect(() => {
    const timer = setTimeout(onReset, 5000);
    return () => clearTimeout(timer);
  }, [onReset]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <CheckCircle className="h-24 w-24 text-green-500 mb-6" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-bold text-foreground mb-2"
      >
        {displayNumber}
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-muted-foreground mb-8"
      >
        {t('pos.order_sent')}
      </motion.p>

      <Button
        variant="outline"
        className="rounded-xl min-h-[56px] px-8 text-base"
        onClick={onReset}
      >
        {t('pos.new_order')}
      </Button>
    </motion.div>
  );
};
