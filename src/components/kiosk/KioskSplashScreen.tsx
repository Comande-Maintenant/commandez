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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background cursor-pointer select-none"
      onClick={onStart}
      onTouchStart={onStart}
    >
      {/* Restaurant branding */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 text-center px-8"
      >
        {restaurant.image ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="w-28 h-28 rounded-3xl object-cover shadow-lg"
          />
        ) : (
          <div className="w-28 h-28 rounded-3xl bg-primary/10 flex items-center justify-center shadow-lg">
            <span className="text-4xl font-bold text-primary">
              {restaurant.name?.charAt(0)?.toUpperCase() || "R"}
            </span>
          </div>
        )}

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {restaurant.name}
          </h1>
          {restaurant.city && (
            <p className="text-lg text-muted-foreground mt-1">{restaurant.city}</p>
          )}
        </div>

        {/* Pulsing CTA */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="mt-8"
        >
          <div className="px-10 py-5 rounded-2xl bg-primary text-primary-foreground text-xl sm:text-2xl font-bold shadow-lg">
            {t("kiosk.splash.touch_to_order")}
          </div>
        </motion.div>
      </motion.div>

      {/* Language selector at bottom */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="flex flex-wrap justify-center gap-2 px-4">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={(e) => {
                e.stopPropagation();
                changeLanguage(lang.code);
              }}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
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
    </div>
  );
};
