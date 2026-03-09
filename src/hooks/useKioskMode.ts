import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const KIOSK_KEY = "cm_kiosk_active";
const KIOSK_CONFIG_KEY = "cm_kiosk_config";

export interface KioskConfig {
  allowTakeaway: boolean;
  askTable: boolean;
  defaultPayment: "counter" | "online" | "both";
  timeoutSeconds: number;
}

const DEFAULT_CONFIG: KioskConfig = {
  allowTakeaway: false,
  askTable: false,
  defaultPayment: "counter",
  timeoutSeconds: 60,
};

function parseConfig(params: URLSearchParams): KioskConfig {
  const modes = params.get("modes");
  const table = params.get("table");
  const payment = params.get("payment");
  const timeout = params.get("timeout");

  return {
    allowTakeaway: modes ? modes.includes("emporter") : DEFAULT_CONFIG.allowTakeaway,
    askTable: table === "ask",
    defaultPayment: (payment === "online" || payment === "counter" || payment === "both") ? payment : DEFAULT_CONFIG.defaultPayment,
    timeoutSeconds: timeout ? parseInt(timeout, 10) || DEFAULT_CONFIG.timeoutSeconds : DEFAULT_CONFIG.timeoutSeconds,
  };
}

function loadStoredConfig(): KioskConfig {
  try {
    const raw = sessionStorage.getItem(KIOSK_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export function useKioskMode() {
  const [searchParams] = useSearchParams();

  const isKiosk = useMemo(() => {
    const fromUrl = searchParams.get("kiosk") === "true" || searchParams.get("mode") === "kiosk";
    if (fromUrl) {
      sessionStorage.setItem(KIOSK_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(KIOSK_KEY) === "1";
  }, [searchParams]);

  const config = useMemo(() => {
    const hasKioskParam = searchParams.get("kiosk") === "true" || searchParams.get("mode") === "kiosk";
    if (hasKioskParam) {
      // Parse from URL and persist
      const parsed = parseConfig(searchParams);
      sessionStorage.setItem(KIOSK_CONFIG_KEY, JSON.stringify(parsed));
      return parsed;
    }
    // Fallback to stored config (e.g. on /order page)
    return loadStoredConfig();
  }, [searchParams]);

  return { isKiosk, config };
}

export function clearKioskSession() {
  sessionStorage.removeItem(KIOSK_KEY);
  sessionStorage.removeItem(KIOSK_CONFIG_KEY);
}
