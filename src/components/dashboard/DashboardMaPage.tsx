import { useState, useEffect, useRef, useCallback } from "react";
import {
  Palette,
  Upload,
  QrCode,
  FileDown,
  Printer,
  ExternalLink,
  Loader2,
  ImageIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { updateRestaurant, uploadRestaurantImage } from "@/lib/api";
import { validateImageSize, resizeImage } from "@/lib/image";
import type { DbRestaurant } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

const primarySwatches = ["#000000", "#1a1a2e", "#16213e", "#e63946", "#2d6a4f", "#f4a261"];
const bgSwatches = ["#ffffff", "#fafafa", "#f5f5f5", "#fef3c7", "#ecfdf5", "#eff6ff"];

export const DashboardMaPage = ({ restaurant }: Props) => {
  const [primaryColor, setPrimaryColor] = useState(restaurant.primary_color || "#000000");
  const [bgColor, setBgColor] = useState(restaurant.bg_color || "#ffffff");
  const [name, setName] = useState(restaurant.name || "");
  const [description, setDescription] = useState(restaurant.description || "");
  const [address, setAddress] = useState(restaurant.address || "");
  const [city, setCity] = useState(restaurant.city || "");
  const [phone, setPhone] = useState(restaurant.restaurant_phone || "");
  const [website, setWebsite] = useState(restaurant.website || "");
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState(restaurant.image || "");
  const [coverPreview, setCoverPreview] = useState(restaurant.cover_image || "");

  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : "";

  const generateQR = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(pageUrl, {
        width: 512,
        margin: 2,
        color: { dark: primaryColor, light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      const svg = await QRCode.toString(pageUrl, {
        type: "svg",
        width: 512,
        margin: 2,
        color: { dark: primaryColor, light: "#ffffff" },
      });
      setQrSvg(svg);
    } catch (e) {
      console.error("QR generation error:", e);
    }
  }, [pageUrl, primaryColor]);

  useEffect(() => { generateQR(); }, [generateQR]);

  const handleSaveColors = async () => {
    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, {
        primary_color: primaryColor,
        bg_color: bgColor,
      } as any);
      toast.success("Couleurs enregistrees");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, {
        name,
        description,
        address,
        city,
        restaurant_phone: phone,
        website,
      } as any);
      toast.success("Informations enregistrees");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const handleUpload = async (file: File, type: "logo" | "cover") => {
    try {
      const url = await uploadRestaurantImage(restaurant.id, file, type);
      if (type === "logo") {
        await updateRestaurant(restaurant.id, { image: url } as any);
        setLogoPreview(url);
      } else {
        await updateRestaurant(restaurant.id, { cover_image: url } as any);
        setCoverPreview(url);
      }
      toast.success(`${type === "logo" ? "Logo" : "Couverture"} mise a jour`);
    } catch (e) {
      toast.error("Erreur lors de l'upload");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = validateImageSize(file);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }
    const resized = await resizeImage(file);
    handleUpload(resized, type);
  };

  const downloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `qr-${restaurant.slug}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const downloadQrSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = `qr-${restaurant.slug}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const generatePdf = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, "F");

    // Logo (if available)
    if (logoPreview) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = logoPreview;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const logoData = canvas.toDataURL("image/png");
        doc.addImage(logoData, "PNG", (pageWidth - 40) / 2, 20, 40, 40);
      } catch {
        // Skip logo if loading fails
      }
    }

    // Restaurant name
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(name, pageWidth / 2, 80, { align: "center" });

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, "PNG", (pageWidth - 80) / 2, 100, 80, 80);
    }

    // "Scannez pour commander"
    doc.setFontSize(18);
    doc.setFont("helvetica", "normal");
    doc.text("Scannez pour commander", pageWidth / 2, 200, { align: "center" });

    // URL
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text(pageUrl, pageWidth / 2, 215, { align: "center" });

    doc.save(`menu-${restaurant.slug}.pdf`);
    toast.success("PDF telecharge");
  };

  const handlePrint = async () => {
    await generatePdf();
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Colors */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Couleurs</h3>
        </div>

        {/* Preview */}
        <div className="rounded-xl p-6 border border-border mb-4 transition-colors" style={{ backgroundColor: bgColor }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full" style={{ backgroundColor: primaryColor }} />
            <div>
              <p className="font-bold" style={{ color: primaryColor }}>{name || "Votre Restaurant"}</p>
              <p className="text-sm opacity-60" style={{ color: primaryColor }}>Apercu en temps reel</p>
            </div>
          </div>
          <div className="inline-block px-4 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
            Commander
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Couleur principale</p>
            <div className="flex flex-wrap gap-2">
              {primarySwatches.map((c) => (
                <button
                  key={c}
                  onClick={() => setPrimaryColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${primaryColor === c ? "border-foreground scale-110" : "border-border"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="w-8 h-8 rounded-full border-2 border-border cursor-pointer overflow-hidden">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-full cursor-pointer opacity-0 absolute" />
                <div className="w-full h-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500 rounded-full" />
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Couleur de fond</p>
            <div className="flex flex-wrap gap-2">
              {bgSwatches.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor === c ? "border-foreground scale-110" : "border-border"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="w-8 h-8 rounded-full border-2 border-border cursor-pointer overflow-hidden">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-full cursor-pointer opacity-0 absolute" />
                <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 rounded-full" />
              </label>
            </div>
          </div>
        </div>

        <Button onClick={handleSaveColors} disabled={saving} className="w-full rounded-xl mt-4">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer les couleurs"}
        </Button>
      </section>

      {/* Logo & Cover */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Logo & Couverture</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Logo</p>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-foreground/30 flex items-center justify-center overflow-hidden transition-colors"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-xs">Cliquer pour uploader</span>
                </div>
              )}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "logo")} />
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Couverture</p>
            <button
              onClick={() => coverInputRef.current?.click()}
              className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-foreground/30 flex items-center justify-center overflow-hidden transition-colors"
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-xs">Cliquer pour uploader</span>
                </div>
              )}
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "cover")} />
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <h3 className="text-base font-semibold text-foreground mb-4">Informations</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Nom du restaurant</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Adresse</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ville</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Telephone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Site web</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1" />
            </div>
          </div>
          <Button onClick={handleSaveInfo} disabled={saving} className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </section>

      {/* QR Codes */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">QR Code</h3>
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
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={downloadQrPng}>
                <FileDown className="h-4 w-4" />PNG
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={downloadQrSvg}>
                <FileDown className="h-4 w-4" />SVG
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* A4 Template */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Printer className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Template A4 imprimable</h3>
        </div>

        {/* Mini preview */}
        <div className="bg-white border border-border rounded-xl p-6 text-center mb-4" style={{ aspectRatio: "210/297", maxHeight: 300 }}>
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {logoPreview && <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-full object-cover" />}
            <p className="text-lg font-bold" style={{ color: primaryColor }}>{name}</p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-24 h-24" />}
            <p className="text-sm text-gray-500">Scannez pour commander</p>
            <p className="text-xs text-gray-400">{pageUrl}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl gap-1.5" onClick={generatePdf}>
            <FileDown className="h-4 w-4" />Telecharger PDF
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" />Imprimer
          </Button>
        </div>
      </section>

      {/* Preview page */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Apercu de votre page</h3>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" asChild>
            <a href={`/${restaurant.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />Voir ma page
            </a>
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-border overflow-hidden bg-background" style={{ height: 400 }}>
          <iframe
            src={`/${restaurant.slug}`}
            className="w-full h-full"
            title="Apercu de la page"
            style={{ pointerEvents: "none" }}
          />
        </div>
      </section>
    </div>
  );
};
