import { useState, useEffect } from "react";
import { fetchCustomizationData } from "@/lib/customizationApi";
import type { CustomizationData } from "@/types/customization";

export function useCustomizationData(restaurantId: string | null) {
  const [data, setData] = useState<CustomizationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setIsLoading(true);

    fetchCustomizationData(restaurantId).then((result) => {
      if (cancelled) return;
      // Only set data if there are actually bases configured
      if (result.bases.length > 0) {
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
