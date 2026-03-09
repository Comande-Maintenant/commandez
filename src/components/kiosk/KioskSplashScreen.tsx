import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/i18n";
import type { DbRestaurant } from "@/types/database";

interface Props {
  restaurant: DbRestaurant;
  onStart: () => void;
}

export const KioskSplashScreen = ({ restaurant, onStart }: Props) => {
  const { t, language, changeLanguage } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background cursor-pointer select-none py-8 sm:py-12 overflow-y-auto"
      onClick={onStart}
    >
      {/* Spacer top */}
      <div className="flex-1" />

      {/* Restaurant branding + CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4 text-center px-6"
      >
        {restaurant.image ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-lg"
          />
        ) : (
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-primary/10 flex items-center justify-center shadow-lg">
            <span className="text-3xl sm:text-4xl font-bold text-primary">
              {restaurant.name?.charAt(0)?.toUpperCase() || "R"}
            </span>
          </div>
        )}

        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground">
            {restaurant.name}
          </h1>
          {restaurant.city && (
            <p className="text-base sm:text-lg text-muted-foreground mt-1">{restaurant.city}</p>
          )}
        </div>

        {/* Pulsing CTA */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="mt-4"
        >
          <div className="px-8 py-4 sm:px-10 sm:py-5 rounded-2xl bg-primary text-primary-foreground text-lg sm:text-2xl font-bold shadow-lg">
            {t("kiosk.splash.touch_to_order")}
          </div>
        </motion.div>
      </motion.div>

      {/* Spacer between CTA and languages */}
      <div className="flex-1 min-h-6" />

      {/* Language selector at bottom - stopPropagation to avoid triggering onStart */}
      <div
        className="flex flex-wrap justify-center gap-1.5 sm:gap-2 px-4 max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={(e) => {
              e.stopPropagation();
              changeLanguage(lang.code);
            }}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              language === lang.code
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>
    </div>
  );
};
