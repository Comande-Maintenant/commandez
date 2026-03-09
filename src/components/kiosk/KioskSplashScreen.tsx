import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/i18n";
import type { DbRestaurant } from "@/types/database";

interface Props {
  restaurant: DbRestaurant;
  onStart: () => void;
}

const PHRASES = [
  "kiosk.splash.phrase1",
  "kiosk.splash.phrase2",
  "kiosk.splash.phrase3",
  "kiosk.splash.phrase4",
  "kiosk.splash.phrase5",
];

const CYCLE_MS = 3000;

export const KioskSplashScreen = ({ restaurant, onStart }: Props) => {
  const { t, language, changeLanguage } = useLanguage();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Trigger entry animation
    requestAnimationFrame(() => setFadeIn(true));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="kiosk-splash"
      onClick={onStart}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        overflow: "hidden",
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Restaurant branding */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          textAlign: "center",
          padding: "0 24px",
          transform: fadeIn ? "scale(1)" : "scale(0.9)",
          transition: "transform 0.5s ease",
        }}
      >
        {restaurant.image ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "24px",
              objectFit: "cover",
              boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "24px",
              backgroundColor: "hsl(var(--primary) / 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            }}
          >
            <span
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                color: "hsl(var(--primary))",
              }}
            >
              {restaurant.name?.charAt(0)?.toUpperCase() || "R"}
            </span>
          </div>
        )}

        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "hsl(var(--foreground))",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {restaurant.name}
          </h1>
          {restaurant.city && (
            <p
              style={{
                fontSize: "16px",
                color: "hsl(var(--muted-foreground))",
                marginTop: "4px",
              }}
            >
              {restaurant.city}
            </p>
          )}
        </div>

        {/* Rotating phrases - eye-catching */}
        <div
          style={{
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            marginTop: "8px",
          }}
        >
          <p
            key={phraseIndex}
            className="kiosk-phrase"
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "hsl(var(--primary))",
              margin: 0,
              animation: "kioskPhraseFade 3s ease-in-out infinite",
            }}
          >
            {t(PHRASES[phraseIndex])}
          </p>
        </div>

        {/* Pulsing CTA */}
        <div
          style={{
            marginTop: "24px",
            animation: "kioskPulse 2s ease-in-out infinite",
          }}
        >
          <div
            style={{
              padding: "18px 40px",
              borderRadius: "16px",
              backgroundColor: "hsl(var(--primary))",
              color: "white",
              fontSize: "22px",
              fontWeight: "bold",
              boxShadow: "0 8px 30px rgba(16, 185, 129, 0.35)",
            }}
          >
            {t("kiosk.splash.touch_to_order")}
          </div>
        </div>
      </div>

      {/* Language flags at bottom */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: "20px",
          left: 0,
          right: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px",
          padding: "0 16px",
        }}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={(e) => {
              e.stopPropagation();
              changeLanguage(lang.code);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
              backgroundColor: language === lang.code ? "hsl(var(--primary))" : "hsl(var(--secondary))",
              opacity: language === lang.code ? 1 : 0.7,
              transition: "opacity 0.2s, background-color 0.2s",
              WebkitTapHighlightColor: "transparent",
              outline: "none",
            }}
            aria-label={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>

      {/* CSS animations - inline for old WebView compat */}
      <style>{`
        @keyframes kioskPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes kioskPhraseFade {
          0% { opacity: 0; transform: translateY(12px); }
          15%, 85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-12px); }
        }
        .kiosk-splash * {
          -webkit-tap-highlight-color: transparent !important;
        }
      `}</style>
    </div>
  );
};
