import { Lightbulb } from "lucide-react";
import { getCurrentDemandTip } from "@/lib/demandPatterns";

export const DemandTip = () => {
  const tip = getCurrentDemandTip();

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-900">Conseil du moment</p>
        <p className="text-sm text-amber-700 mt-0.5">{tip}</p>
      </div>
    </div>
  );
};
