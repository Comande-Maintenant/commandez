import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Tablet, Settings2, BookOpen } from "lucide-react";
import QRCode from "qrcode";
import type { DbRestaurant } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  restaurant: DbRestaurant;
}

export const DashboardBorneClient = ({ restaurant }: Props) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Config state
  const [allowTakeaway, setAllowTakeaway] = useState(false);
  const [askTable, setAskTable] = useState(false);
  const [defaultPayment, setDefaultPayment] = useState("counter");
  const [timeout, setTimeout_] = useState("60");

  // Build the kiosk URL dynamically based on config
  const baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${restaurant.slug}?kiosk=true`
    : "";

  const kioskUrl = (() => {
    const params = new URLSearchParams();
    params.set("kiosk", "true");
    if (allowTakeaway) params.set("modes", "surplace,emporter");
    if (askTable) params.set("table", "ask");
    if (defaultPayment !== "counter") params.set("payment", defaultPayment);
    if (timeout !== "60") params.set("timeout", timeout);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/${restaurant.slug}?${params.toString()}`;
  })();

  // Generate QR code
  const generateQR = useCallback(async () => {
    try {
      const url = await QRCode.toDataURL(kioskUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(url);
    } catch { /* ignore */ }
  }, [kioskUrl]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const copyLink = () => {
    navigator.clipboard.writeText(kioskUrl);
    setCopied(true);
    toast.success(t("admin.kiosk.link_copied"));
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">{t("admin.kiosk.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.kiosk.subtitle")}</p>
      </div>

      {/* Section 1: Link + QR */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Tablet className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t("admin.kiosk.link")}</h3>
        </div>

        {/* URL display */}
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 bg-secondary rounded-xl text-sm text-foreground font-mono break-all select-all">
            {kioskUrl}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl flex-shrink-0 gap-1.5"
            onClick={copyLink}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {t("admin.kiosk.copy_link")}
          </Button>
        </div>

        {/* QR Code */}
        {qrDataUrl && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-sm font-medium text-muted-foreground">{t("admin.kiosk.qr_code")}</p>
            <img
              src={qrDataUrl}
              alt="QR Code Borne"
              className="w-48 h-48 rounded-xl border border-border"
            />
            <a
              href={qrDataUrl}
              download={`borne-${restaurant.slug}.png`}
              className="text-xs text-primary hover:underline"
            >
              {t("admin.kiosk.download_qr")}
            </a>
          </div>
        )}
      </div>

      {/* Section 2: Configuration */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t("admin.kiosk.config.title")}</h3>
        </div>

        {/* Order modes */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("admin.kiosk.config.mode_takeaway")}</p>
            <p className="text-xs text-muted-foreground">{t("admin.kiosk.config.mode_takeaway_desc")}</p>
          </div>
          <Switch checked={allowTakeaway} onCheckedChange={setAllowTakeaway} />
        </div>

        {/* Table number */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("admin.kiosk.config.ask_table")}</p>
            <p className="text-xs text-muted-foreground">{t("admin.kiosk.config.ask_table_desc")}</p>
          </div>
          <Switch checked={askTable} onCheckedChange={setAskTable} />
        </div>

        {/* Default payment */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("admin.kiosk.config.payment_default")}</Label>
          <Select value={defaultPayment} onValueChange={setDefaultPayment}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="counter">{t("admin.kiosk.config.payment_counter")}</SelectItem>
              <SelectItem value="online">{t("admin.kiosk.config.payment_online")}</SelectItem>
              <SelectItem value="both">{t("admin.kiosk.config.payment_both")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timeout */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("admin.kiosk.config.timeout")}</Label>
          <Select value={timeout} onValueChange={setTimeout_}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
              <SelectItem value="90">90s</SelectItem>
              <SelectItem value="0">{t("admin.kiosk.config.timeout_disabled")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section 3: Setup guide */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t("admin.kiosk.guide.title")}</h3>
        </div>

        <div className="space-y-3">
          {[
            { num: "1", text: t("admin.kiosk.guide.step1") },
            { num: "2", text: t("admin.kiosk.guide.step2") },
            { num: "3", text: t("admin.kiosk.guide.step3") },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{step.num}</span>
              </div>
              <p className="text-sm text-muted-foreground pt-1">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
