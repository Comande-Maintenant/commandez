import { useState, useRef } from "react";
import {
  Palette,
  Upload,
  ExternalLink,
  Loader2,
  ImageIcon,
  Copy,
  Check,
} from "lucide-react";
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState(restaurant.image || "");
  const [coverPreview, setCoverPreview] = useState(restaurant.cover_image || "");

  const [copied, setCopied] = useState(false);
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    toast.success("Lien copie !");
    setTimeout(() => setCopied(false), 2000);
  };

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

  return (
    <div className="max-w-2xl space-y-8">
      {/* Link */}
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
