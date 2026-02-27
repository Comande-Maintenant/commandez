import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyzeMenuImages } from '@/services/menu-analysis';
import { extractColors } from '@/services/color-extraction';
import type { AnalyzedMenu, ExtractedColors } from '@/types/onboarding';

interface MenuUploadProps {
  onAnalysisComplete: (menu: AnalyzedMenu, colors?: ExtractedColors) => void;
  onSkip: () => void;
}

export function MenuUpload({ onAnalysisComplete, onSkip }: MenuUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)
    );
    setFiles((prev) => [...prev, ...accepted]);
    setError('');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError('');

    try {
      const menu = await analyzeMenuImages(files);

      // Try color extraction from first image
      let colors: ExtractedColors | undefined;
      try {
        const url = URL.createObjectURL(files[0]);
        colors = await extractColors(url);
        URL.revokeObjectURL(url);
      } catch {
        // Color extraction is optional
      }

      onAnalysisComplete(menu, colors);
    } catch (err) {
      setError('Erreur lors de l\'analyse. Verifiez vos images et reessayez.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors"
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">
          Deposez vos photos de carte ici
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG ou PDF - Plusieurs fichiers acceptes
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Camera button for mobile */}
      <Button
        variant="outline"
        className="w-full sm:hidden"
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="h-4 w-4 mr-2" />
        Prendre une photo
      </Button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="ml-auto text-destructive text-xs hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleAnalyze}
        disabled={files.length === 0 || loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Analyse de votre carte en cours...
          </>
        ) : (
          'Analyser ma carte'
        )}
      </Button>

      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Creer ma carte manuellement
      </button>
    </div>
  );
}
