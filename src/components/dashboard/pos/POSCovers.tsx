import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Props {
  onSelect: (covers: number) => void;
  onBack: () => void;
}

export const POSCovers = ({ onSelect, onBack }: Props) => {
  const [custom, setCustom] = useState(9);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4"
    >
      <button
        onClick={onBack}
        className="absolute top-4 left-4 p-3 rounded-full hover:bg-secondary transition-colors"
      >
        <ArrowLeft className="h-6 w-6 text-foreground" />
      </button>

      <h2 className="text-2xl font-bold text-foreground mb-8">Nombre de couverts</h2>

      <div className="grid grid-cols-4 gap-3 w-full max-w-sm mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className="aspect-square flex items-center justify-center bg-card border border-border rounded-2xl text-2xl font-bold text-foreground hover:shadow-md hover:border-foreground/20 transition-all active:scale-[0.95] min-h-[64px]"
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 w-full max-w-sm">
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl h-12 w-12 flex-shrink-0"
          onClick={() => setCustom((c) => Math.max(9, c - 1))}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <span className="text-3xl font-bold text-foreground flex-1 text-center">{custom}</span>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl h-12 w-12 flex-shrink-0"
          onClick={() => setCustom((c) => c + 1)}
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          className="rounded-xl min-h-[48px] px-6"
          onClick={() => onSelect(custom)}
        >
          OK
        </Button>
      </div>
    </motion.div>
  );
};
