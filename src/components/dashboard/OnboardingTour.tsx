import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";

interface Step {
  title: string;
  description: string;
  selector: string;
  position: "top" | "bottom" | "left" | "right";
}

interface Props {
  onComplete: () => void;
}

export const OnboardingTour = ({ onComplete }: Props) => {
  const { t } = useLanguage();

  const steps = useMemo<Step[]>(() => [
    {
      title: t('dashboard.onboarding.step_kitchen'),
      description: t('dashboard.onboarding.step_kitchen_desc'),
      selector: '[data-tour="cuisine"]',
      position: "bottom",
    },
    {
      title: t('dashboard.onboarding.step_pos'),
      description: t('dashboard.onboarding.step_pos_desc'),
      selector: '[data-tour="caisse"]',
      position: "bottom",
    },
    {
      title: t('dashboard.onboarding.step_live'),
      description: t('dashboard.onboarding.step_live_desc'),
      selector: '[data-tour="en-direct"]',
      position: "bottom",
    },
    {
      title: t('dashboard.onboarding.step_manage'),
      description: t('dashboard.onboarding.step_manage_desc'),
      selector: '[data-tour="gerer"]',
      position: "top",
    },
    {
      title: t('dashboard.onboarding.step_availability'),
      description: t('dashboard.onboarding.step_availability_desc'),
      selector: '[data-tour="disponible"]',
      position: "bottom",
    },
    {
      title: t('dashboard.onboarding.step_sound'),
      description: t('dashboard.onboarding.step_sound_desc'),
      selector: '[data-tour="son"]',
      position: "bottom",
    },
  ], [t]);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    // Try to find the element
    let el: Element | undefined = [...document.querySelectorAll(step.selector)].find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    // Fallback: try to find by text content in nav buttons
    if (!el) {
      const buttons = document.querySelectorAll("button, a");
      for (const btn of buttons) {
        if (btn.textContent?.trim() === step.title && btn.getBoundingClientRect().width > 0) {
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

  useLayoutEffect(() => {
    const observer = new ResizeObserver(updatePosition);
    if (tooltipRef.current) observer.observe(tooltipRef.current);
    return () => observer.disconnect();
  }, [currentStep, updatePosition]);

  const tooltipStyle = (): React.CSSProperties => {
    const padding = 16;
    const width = Math.min(300, window.innerWidth - padding * 2);
    const height = tooltipRef.current?.offsetHeight || 300;
    const maxTop = Math.max(padding, window.innerHeight - height - padding);
    let top = (window.innerHeight - height) / 2;
    let left = (window.innerWidth - width) / 2;
    if (targetRect) {
      top = step.position === 'top' ? targetRect.top - height - padding : targetRect.bottom + padding;
      if (step.position === 'bottom' && top > maxTop) top = targetRect.top - height - padding;
      left = targetRect.left + targetRect.width / 2 - width / 2;
    }
    return {
      top: Math.max(padding, Math.min(top, maxTop)),
      left: Math.max(padding, Math.min(left, window.innerWidth - width - padding)),
      width,
      maxHeight: window.innerHeight - padding * 2,
      overflowY: 'auto',
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
          ref={tooltipRef}
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute bg-card border border-border rounded-2xl shadow-2xl p-5 w-[300px]"
          style={tooltipStyle()}
        >
          <button
            onClick={onComplete}
            aria-label={t('common.close')}
            className="absolute top-3 end-3 p-1 rounded-lg hover:bg-secondary"
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
              <ChevronLeft className="h-4 w-4 rtl:scale-x-[-1]" />
              {t('common.previous')}
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
              {isLast ? t('common.finish') : t('common.next')}
              {!isLast && <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" />}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};
