const VISITOR_KEY = "cm_visitor_id";

export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function detectDevice(): "mobile" | "desktop" {
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

export function detectSource(): "qr" | "direct" | "link" {
  const params = new URLSearchParams(window.location.search);
  if (params.has("qr")) return "qr";
  if (document.referrer && new URL(document.referrer).host !== window.location.host) return "link";
  return "direct";
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced;
}

export function classifyActivity(lastActive: string): "active" | "idle" | "inactive" {
  const elapsed = Date.now() - new Date(lastActive).getTime();
  if (elapsed < 3 * 60 * 1000) return "active";
  if (elapsed < 5 * 60 * 1000) return "idle";
  return "inactive";
}
