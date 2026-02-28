import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

interface Step {
  title: string;
  description: string;
  selector: string;
  position: "top" | "bottom" | "left" | "right";
}

const steps: Step[] = [
  {
    title: "Cuisine",
    description: "Ici, vous recevez et gerez toutes les commandes. Acceptez, preparez, et marquez comme prete en un clic.",
    selector: '[data-tour="cuisine"]',
    position: "bottom",
  },
  {
    title: "Caisse",
    description: "Prenez des commandes manuellement pour les clients sur place ou par telephone.",
    selector: '[data-tour="caisse"]',
    position: "bottom",
  },
  {
    title: "En direct",
    description: "Voyez qui visite votre page en temps reel, leur panier et les alertes d'activite.",
    selector: '[data-tour="en-direct"]',
    position: "bottom",
  },
  {
    title: "Gerer",
    description: "Accedez a votre carte, page, QR codes, clients, parametres et statistiques.",
    selector: '[data-tour="gerer"]',
    position: "top",
  },
  {
    title: "Disponibilite",
    description: "Ce toggle active ou desactive les commandes instantanement. Pratique pour les pauses ou fermetures.",
    selector: '[data-tour="disponible"]',
    position: "bottom",
  },
  {
    title: "Son",
    description: "Activez le son pour etre alerte a chaque nouvelle commande. Indispensable en service !",
    selector: '[data-tour="son"]',
    position: "bottom",
  },
];

interface Props {
  onComplete: () => void;
}

export const OnboardingTour = ({ onComplete }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    // Try to find the element
    let el = document.querySelector(step.selector);

    // Fallback: try to find by text content in nav buttons
    if (!el) {
      const buttons = document.querySelectorAll("button, a");
      for (const btn of buttons) {
        if (btn.textContent?.trim() === step.title) {
          el = btn;
          break;
        }
      }
    }

    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [updatePosition]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const tooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    const padding = 16;
    const tooltipWidth = 300;

    if (step.position === "bottom") {
      return {
        top: targetRect.bottom + padding,
        left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding)),
      };
    }
    if (step.position === "top") {
      return {
        bottom: window.innerHeight - targetRect.top + padding,
        left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding)),
      };
    }
    return {
      top: targetRect.top,
      left: targetRect.right + padding,
    };
  };

  return createPortal(
    <div className="fixed inset-0 z-[100]" ref={overlayRef}>
      {/* Overlay with spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.6)",
          ...(targetRect
            ? {
                maskImage: `radial-gradient(ellipse ${targetRect.width + 24}px ${targetRect.height + 24}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 50%, black 51%)`,
                WebkitMaskImage: `radial-gradient(ellipse ${targetRect.width + 24}px ${targetRect.height + 24}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 50%, black 51%)`,
              }
            : {}),
        }}
        onClick={onComplete}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute bg-card border border-border rounded-2xl shadow-2xl p-5 w-[300px]"
          style={tooltipStyle()}
        >
          <button
            onClick={onComplete}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-secondary"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="mb-1 text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{step.description}</p>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="rounded-xl gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (isLast) {
                  onComplete();
                } else {
                  setCurrentStep((s) => s + 1);
                }
              }}
              className="rounded-xl gap-1"
            >
              {isLast ? "Terminer" : "Suivant"}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};
