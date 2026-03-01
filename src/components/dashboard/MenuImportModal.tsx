import { useState, useRef } from "react";
import { Camera, FileUp, Loader2, ArrowLeft, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MenuReviewEditor } from "@/components/onboarding/MenuReviewEditor";
import { analyzeMenuImages } from "@/services/menu-analysis";
import { convertFilesForAnalysis } from "@/utils/file-converter";
import { insertMenuItem, updateRestaurantCategories, fetchAllMenuItems } from "@/lib/api";
import type { AnalyzedCategory } from "@/types/onboarding";
import type { DbRestaurant, DbMenuItem } from "@/types/database";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: DbRestaurant;
  existingItems: DbMenuItem[];
  onImportComplete: () => void;
}

type Step = "upload" | "analyzing" | "review" | "saving";

export const MenuImportModal = ({ open, onOpenChange, restaurant, existingItems, onImportComplete }: Props) => {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [analyzedCategories, setAnalyzedCategories] = useState<AnalyzedCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFiles([]);
    setAnalyzedCategories([]);
    setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const { converted, errors } = await convertFilesForAnalysis(Array.from(newFiles));
    if (errors.length > 0) {
      toast.error(`${errors.length} fichier(s) non convertis`);
    }
    if (converted.length === 0) {
      toast.error("Aucun fichier exploitable.");
      return;
    }
    const allFiles = [...files, ...converted];
    setFiles(allFiles);
    await startAnalysis(allFiles);
  };

  const startAnalysis = async (filesToAnalyze: File[]) => {
    setStep("analyzing");
    setError(null);
    try {
      const result = await analyzeMenuImages(filesToAnalyze);
      setAnalyzedCategories(result.categories);
      setStep("review");
    } catch (e: any) {
      console.error("Analysis error:", e);
      setError(e.message || "Erreur lors de l'analyse");
      setStep("upload");
    }
  };

  const handleConfirm = async (categories: AnalyzedCategory[]) => {
    setStep("saving");
    try {
      // Build a set of existing item keys (name lowercase + category lowercase) for dedup
      const existingKeys = new Set(
        existingItems.map((i) => `${i.name.toLowerCase().trim()}::${i.category.toLowerCase().trim()}`)
      );

      const existingCategories = new Set((restaurant.categories ?? []).map((c) => c.toLowerCase().trim()));
      const newCategoryNames: string[] = [];
      let added = 0;
      let skipped = 0;

      // Get current max sort_order
      const maxSort = existingItems.reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0);
      let sortOrder = maxSort + 1;

      for (const category of categories) {
        const catName = category.name.trim();
        if (!catName) continue;

        // Track new categories
        if (!existingCategories.has(catName.toLowerCase())) {
          newCategoryNames.push(catName);
          existingCategories.add(catName.toLowerCase());
        }

        for (const item of category.items) {
          const itemName = item.name.trim();
          if (!itemName) continue;

          const key = `${itemName.toLowerCase()}::${catName.toLowerCase()}`;
          if (existingKeys.has(key)) {
            skipped++;
            continue;
          }

          const supplements = (item.supplements ?? []).map((s, i) => ({
            id: `supp-${Date.now()}-${i}`,
            name: s.name,
            price: s.price,
          }));

          await insertMenuItem({
            restaurant_id: restaurant.id,
            name: itemName,
            description: item.description || "",
            price: item.price,
            category: catName,
            enabled: true,
            popular: false,
            sort_order: sortOrder++,
            supplements: supplements.length > 0 ? supplements : undefined,
          });

          existingKeys.add(key);
          added++;
        }
      }

      // Update restaurant categories array if new ones were added
      if (newCategoryNames.length > 0) {
        const updatedCategories = [...(restaurant.categories ?? []), ...newCategoryNames];
        await updateRestaurantCategories(restaurant.id, updatedCategories);
      }

      const parts: string[] = [];
      if (added > 0) parts.push(`${added} article${added > 1 ? "s" : ""} ajoute${added > 1 ? "s" : ""}`);
      if (skipped > 0) parts.push(`${skipped} doublon${skipped > 1 ? "s" : ""} ignore${skipped > 1 ? "s" : ""}`);
      if (newCategoryNames.length > 0) parts.push(`${newCategoryNames.length} nouvelle${newCategoryNames.length > 1 ? "s" : ""} categorie${newCategoryNames.length > 1 ? "s" : ""}`);

      toast.success(parts.length > 0 ? parts.join(", ") : "Import termine");
      onImportComplete();
      handleClose(false);
    } catch (e: any) {
      console.error("Import error:", e);
      toast.error("Erreur lors de l'import");
      setStep("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Importer des elements
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Prenez en photo ou importez un fichier pour completer votre carte automatiquement.
            </p>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800">
                Vous pouvez photographier votre liste de sauces, vos boissons, un nouveau menu, ou toute information manquante. L'analyse est automatique et les elements seront ajoutes a votre carte existante.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-sm text-destructive">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-6 bg-card border border-border rounded-2xl hover:shadow-md hover:border-foreground/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Camera className="h-8 w-8 text-foreground" />
                <span className="text-sm font-medium text-foreground">Prendre une photo</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-6 bg-card border border-border rounded-2xl hover:shadow-md hover:border-foreground/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <FileUp className="h-8 w-8 text-foreground" />
                <span className="text-sm font-medium text-foreground">Choisir un fichier</span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Photos, PDF, captures d'ecran... tous formats acceptes.
            </p>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.heic,.heif,.svg"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
            <p className="text-xs text-muted-foreground">L'IA lit votre document et extrait les elements.</p>
          </div>
        )}

        {step === "review" && (
          <div className="mt-2">
            <MenuReviewEditor
              menu={analyzedCategories}
              onConfirm={handleConfirm}
              onBack={() => { reset(); }}
            />
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-sm text-muted-foreground">Ajout des elements a votre carte...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
