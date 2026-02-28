import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  orderNumber: number;
  onReset: () => void;
}

export const POSSuccess = ({ orderNumber, onReset }: Props) => {
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
        #{orderNumber}
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-muted-foreground mb-8"
      >
        Commande envoyee en cuisine
      </motion.p>

      <Button
        variant="outline"
        className="rounded-xl min-h-[56px] px-8 text-base"
        onClick={onReset}
      >
        Nouvelle commande
      </Button>
    </motion.div>
  );
};
