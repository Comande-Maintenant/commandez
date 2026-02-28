import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  FileDown,
  Printer,
  Copy,
  Check,
  Receipt,
  Package,
  Image as ImageIcon,
  Lightbulb,
} from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { DbRestaurant } from "@/types/database";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

export const DashboardQRCodes = ({ restaurant }: Props) => {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [qrHdDataUrl, setQrHdDataUrl] = useState("");
  const [posQrDataUrl, setPosQrDataUrl] = useState("");
  const [posQrSvg, setPosQrSvg] = useState("");
  const [packQrDataUrl, setPackQrDataUrl] = useState("");
  const [packQrSvg, setPackQrSvg] = useState("");
  const [copied, setCopied] = useState(false);

  const primaryColor = restaurant.primary_color || "#000000";
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : "";
  const posUrl = typeof window !== "undefined" ? `${window.location.origin}/admin/${restaurant.slug}?tab=caisse` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    toast.success("Lien copie !");
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQR = useCallback(async () => {
    try {
      // Main QR 512px
      const dataUrl = await QRCode.toDataURL(pageUrl, {
        width: 512,
        margin: 2,
        color: { dark: primaryColor, light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);

      // Main QR HD 1024px
      const hdDataUrl = await QRCode.toDataURL(pageUrl, {
        width: 1024,
        margin: 2,
        color: { dark: primaryColor, light: "#ffffff" },
      });
      setQrHdDataUrl(hdDataUrl);

      const svg = await QRCode.toString(pageUrl, {
        type: "svg",
        width: 512,
        margin: 2,
        color: { dark: primaryColor, light: "#ffffff" },
      });
      setQrSvg(svg);

      // POS QR Code
      const posDataUrl = await QRCode.toDataURL(posUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#1d4ed8", light: "#ffffff" },
      });
      setPosQrDataUrl(posDataUrl);
      const posSvgStr = await QRCode.toString(posUrl, {
        type: "svg",
        width: 512,
        margin: 2,
        color: { dark: "#1d4ed8", light: "#ffffff" },
      });
      setPosQrSvg(posSvgStr);

      // Packaging QR 300px
      const packDataUrl = await QRCode.toDataURL(pageUrl, {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setPackQrDataUrl(packDataUrl);
      const packSvgStr = await QRCode.toString(pageUrl, {
        type: "svg",
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setPackQrSvg(packSvgStr);
    } catch (e) {
      console.error("QR generation error:", e);
    }
  }, [pageUrl, posUrl, primaryColor]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const downloadPng = (dataUrl: string, filename: string) => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const downloadSvg = (svgStr: string, filename: string) => {
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const loadImageAsDataUrl = async (src: string): Promise<string | null> => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  // PDF A4 - 6 QR codes grid (2x3)
  const generateA4Pdf = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = 210;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, "F");

    const logoData = restaurant.image ? await loadImageAsDataUrl(restaurant.image) : null;

    const qrSize = 55;
    const cols = 2;
    const rows = 3;
    const marginX = (pw - cols * qrSize) / (cols + 1);
    const startY = 20;
    const gapY = 12;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = marginX + col * (qrSize + marginX);
        const y = startY + row * (qrSize + gapY + 20);

        // Restaurant name
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(restaurant.name, x + qrSize / 2, y, { align: "center" });

        // QR
        if (qrDataUrl) {
          doc.addImage(qrDataUrl, "PNG", x, y + 3, qrSize, qrSize);
        }

        // Logo overlay
        if (logoData) {
          const logoSize = 12;
          doc.addImage(logoData, "PNG", x + (qrSize - logoSize) / 2, y + 3 + (qrSize - logoSize) / 2, logoSize, logoSize);
        }

        // "Scannez pour commander"
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Scannez pour commander", x + qrSize / 2, y + qrSize + 8, { align: "center" });
      }
    }

    doc.save(`qr-fiche-a4-${restaurant.slug}.pdf`);
    toast.success("Fiche A4 telechargee");
  };

  // PDF A3 - Vitrine/Affiche grand format
  const generateVitrinePdf = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const pw = 297;
    const ph = 420;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    const logoData = restaurant.image ? await loadImageAsDataUrl(restaurant.image) : null;

    // Logo
    if (logoData) {
      doc.addImage(logoData, "PNG", (pw - 50) / 2, 30, 50, 50);
    }

    // Restaurant name
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(restaurant.name, pw / 2, logoData ? 100 : 60, { align: "center" });

    // Description
    if (restaurant.description) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(restaurant.description, pw - 60);
      doc.text(descLines, pw / 2, logoData ? 115 : 75, { align: "center" });
    }

    // QR Code centered
    const qrY = logoData ? 140 : 100;
    const qrSize = 120;
    if (qrHdDataUrl) {
      doc.addImage(qrHdDataUrl, "PNG", (pw - qrSize) / 2, qrY, qrSize, qrSize);
    }

    // "Scannez pour commander"
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Scannez pour commander", pw / 2, qrY + qrSize + 20, { align: "center" });

    // URL
    doc.setFontSize(14);
    doc.setTextColor(120, 120, 120);
    doc.text(pageUrl, pw / 2, qrY + qrSize + 35, { align: "center" });

    doc.save(`qr-vitrine-a3-${restaurant.slug}.pdf`);
    toast.success("Affiche vitrine telechargee");
  };

  // PNG HD for vitrine
  const downloadVitrineHdPng = () => {
    downloadPng(qrHdDataUrl, `qr-vitrine-hd-${restaurant.slug}.png`);
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Link + copy */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground mb-1">Lien de votre page</h3>
            <p className="text-sm text-muted-foreground truncate">{pageUrl}</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 flex-shrink-0 ml-3" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copie !" : "Copier"}
          </Button>
        </div>
      </section>

      {/* 1. QR Principal */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">QR Code principal</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {qrDataUrl && (
            <div className="bg-white p-4 rounded-xl border border-border">
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ce QR code pointe vers votre page :<br />
              <span className="font-medium text-foreground">{pageUrl}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => downloadPng(qrDataUrl, `qr-${restaurant.slug}.png`)}>
                <FileDown className="h-4 w-4" />PNG
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => downloadSvg(qrSvg, `qr-${restaurant.slug}.svg`)}>
                <FileDown className="h-4 w-4" />SVG
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={copyLink}>
                <Copy className="h-4 w-4" />Copier le lien
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Fiche imprimable A4 (2x3 grid) */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Printer className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Fiche imprimable A4</h3>
        </div>

        {/* Mini preview */}
        <div className="bg-white border border-border rounded-xl p-6 text-center mb-4" style={{ aspectRatio: "210/297", maxHeight: 280 }}>
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm font-bold text-gray-700">6 QR codes avec votre nom et logo</p>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-gray-400" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Ideal pour les tables</p>
          </div>
        </div>

        <Button variant="outline" className="w-full rounded-xl gap-1.5" onClick={generateA4Pdf}>
          <FileDown className="h-4 w-4" />Telecharger PDF A4
        </Button>
      </section>

      {/* 3. QR Emballage (compact) */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">QR Emballage</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {packQrDataUrl && (
            <div className="bg-white p-3 rounded-xl border border-border">
              <img src={packQrDataUrl} alt="QR Emballage" className="w-32 h-32" />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              Format compact pour emballages et sacs.<br />
              <span className="text-xs">Commandez en ligne, recuperez sur place</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => downloadPng(packQrDataUrl, `qr-emballage-${restaurant.slug}.png`)}>
                <FileDown className="h-4 w-4" />PNG
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => downloadSvg(packQrSvg, `qr-emballage-${restaurant.slug}.svg`)}>
                <FileDown className="h-4 w-4" />SVG
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. QR Vitrine / Affiche */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">QR Vitrine / Affiche</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Grand format avec logo, nom et description. Parfait pour votre vitrine ou un panneau.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl gap-1.5" onClick={generateVitrinePdf}>
            <FileDown className="h-4 w-4" />PDF A3
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5" onClick={downloadVitrineHdPng}>
            <FileDown className="h-4 w-4" />PNG HD (1024px)
          </Button>
        </div>
      </section>

      {/* QR Code Caisse */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">QR Code Caisse</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {posQrDataUrl && (
            <div className="bg-white p-4 rounded-xl border border-border">
              <img src={posQrDataUrl} alt="QR Code Caisse" className="w-48 h-48" />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ce QR code ouvre directement la caisse sur tablette :<br />
              <span className="font-medium text-foreground">{posUrl}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => downloadPng(posQrDataUrl, `qr-caisse-${restaurant.slug}.png`)}
              >
                <FileDown className="h-4 w-4" />PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => downloadSvg(posQrSvg, `qr-caisse-${restaurant.slug}.svg`)}
              >
                <FileDown className="h-4 w-4" />SVG
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Tip */}
      <section className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Astuce</p>
            <p className="text-sm text-amber-800 mt-1">
              Imprimez la fiche A4 et decoupez les QR codes pour vos tables.
              Le format SVG est ideal pour une impression grand format sans perte de qualite.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
