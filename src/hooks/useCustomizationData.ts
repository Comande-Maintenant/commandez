import { useState, useEffect } from "react";
import { fetchUniversalCustomizationData } from "@/lib/customizationApi";
import type { UniversalCustomizationData } from "@/types/customization";

export function useCustomizationData(restaurantId: string | null) {
  const [data, setData] = useState<UniversalCustomizationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setIsLoading(true);

    fetchUniversalCustomizationData(restaurantId).then((result) => {
      if (cancelled) return;
      // Activate if there are step templates OR bases configured
      if (result.stepTemplates.length > 0 || result.bases.length > 0) {
        setData(result);
      }
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [restaurantId]);

  return { data, isLoading };
}
