import { Lightbulb } from "lucide-react";
import { getCurrentDemandTip } from "@/lib/demandPatterns";
import { useLanguage } from "@/context/LanguageContext";

export const DemandTip = () => {
  const { t } = useLanguage();
  const tipKey = getCurrentDemandTip();

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-900">{t("dashboard.demand.tip_title")}</p>
        <p className="text-sm text-amber-700 mt-0.5">{t(tipKey)}</p>
      </div>
    </div>
  );
};
