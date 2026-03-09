import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEKLY_PATTERNS, getIntensityColor, getIntensityLabel, getDayName, getWeekDays } from "@/lib/demandPatterns";
import { useLanguage } from "@/context/LanguageContext";

export const DemandCalendar = () => {
  const { t } = useLanguage();
  const today = new Date().getDay();
  const weekDays = getWeekDays(); // [1,2,3,4,5,6,0]

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t("dashboard.demand.calendar_title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header row */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {weekDays.map((d) => (
            <div key={d} className="text-center">
              <span className={`text-xs font-medium ${d === today ? "text-foreground" : "text-muted-foreground"}`}>
                {t(getDayName(d))}
              </span>
            </div>
          ))}
        </div>

        {/* Midi row */}
        <div className="mb-1">
          <p className="text-xs text-muted-foreground mb-1">{t("dashboard.demand.lunch")}</p>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d) => {
              const val = WEEKLY_PATTERNS[d].midi;
              return (
                <div
                  key={`midi-${d}`}
                  className={`rounded-lg p-2 text-center text-xs font-medium ${getIntensityColor(val)} ${d === today ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                  title={`${t(getDayName(d))} ${t("dashboard.demand.lunch").toLowerCase()} : ${t(getIntensityLabel(val))} (${val}%)`}
                >
                  {val}
                </div>
              );
            })}
          </div>
        </div>

        {/* Soir row */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t("dashboard.demand.dinner")}</p>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d) => {
              const val = WEEKLY_PATTERNS[d].soir;
              return (
                <div
                  key={`soir-${d}`}
                  className={`rounded-lg p-2 text-center text-xs font-medium ${getIntensityColor(val)} ${d === today ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                  title={`${t(getDayName(d))} ${t("dashboard.demand.dinner").toLowerCase()} : ${t(getIntensityLabel(val))} (${val}%)`}
                >
                  {val}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100" /> {t("dashboard.demand.calm")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" /> {t("dashboard.demand.moderate")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-200" /> {t("dashboard.demand.busy")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200" /> {t("dashboard.demand.very_busy")}</span>
        </div>
      </CardContent>
    </Card>
  );
};
