import { useState, useCallback } from "react";
import { Phone } from "lucide-react";

interface Props {
  phone: string;
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  variant?: "inline" | "button";
}

/**
 * Anti-scraping phone component.
 * - No tel: link in the HTML source
 * - Phone number only appears after user interaction (click)
 * - Call initiated via JS on second click
 * Bots see "Afficher le numero", real users click to reveal.
 */
export const ProtectedPhone = ({ phone, className = "", style, iconClassName, variant = "inline" }: Props) => {
  const [revealed, setRevealed] = useState(false);

  const formatPhone = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) {
      return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
    }
    return raw;
  }, []);

  const handleClick = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    // Assemble tel: link in JS only, never in HTML
    const digits = phone.replace(/\D/g, "");
    window.location.href = `tel:${digits}`;
  }, [revealed, phone]);

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 font-medium ${className}`}
        style={style}
      >
        <Phone className={iconClassName || "h-4 w-4"} />
        {revealed ? formatPhone(phone) : "Afficher le numero"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 underline underline-offset-2 font-medium ${className}`}
      style={style}
    >
      {revealed ? formatPhone(phone) : "Afficher le numero"}
    </button>
  );
};
