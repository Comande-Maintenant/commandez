import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

export function useDemoMode() {
  const { slug } = useParams<{ slug: string }>();
  const isDemo = slug === "demo";
  const { t } = useLanguage();

  const blockIfDemo = (messageKey?: string) => {
    if (!isDemo) return false;
    toast.info(t(messageKey || "demo.readonly_toast"));
    return true;
  };

  return { isDemo, blockIfDemo };
}
