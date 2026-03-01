import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyzeMenuImages } from '@/services/menu-analysis';
import { extractColors } from '@/services/color-extraction';
import { convertFilesForAnalysis } from '@/utils/file-converter';
import type { AnalyzedMenu, ExtractedColors } from '@/types/onboarding';

interface MenuUploadProps {
  onAnalysisComplete: (menu: AnalyzedMenu, colors?: ExtractedColors) => void;
  onSkip: () => void;
}

export function MenuUpload({ onAnalysisComplete, onSkip }: MenuUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [conversionErrors, setConversionErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    setError('');
    setConversionErrors([]);
    setConverting(true);

    try {
      const { converted, errors } = await convertFilesForAnalysis(Array.from(newFiles));
      if (errors.length > 0) {
        setConversionErrors(errors);
      }
      if (converted.length > 0) {
        setFiles((prev) => [...prev, ...converted]);
      }
    } catch {
      setError('Erreur lors de la conversion des fichiers.');
    } finally {
      setConverting(false);
    }
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

      // Try color extraction from first image (non-blocking)
      let colors: ExtractedColors | undefined;
      const firstImage = files.find((f) => f.type.startsWith('image/'));
      if (firstImage) {
        try {
          const url = URL.createObjectURL(firstImage);
          colors = await extractColors(url);
          URL.revokeObjectURL(url);
        } catch {
          // Color extraction is optional
        }
      }

      onAnalysisComplete(menu, colors);
    } catch (err) {
      setError('Erreur lors de l\'analyse. Verifiez vos fichiers et reessayez.');
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
          Photos, PDF, captures d'ecran... tous formats acceptes
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.heic,.heif,.svg"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset input so same file can be re-selected
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* Camera button for mobile */}
      <Button
        variant="outline"
        className="w-full sm:hidden"
        onClick={() => cameraRef.current?.click()}
        disabled={converting}
      >
        <Camera className="h-4 w-4 mr-2" />
        Prendre une photo
      </Button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Converting indicator */}
      {converting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Conversion des fichiers en cours...
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {files.length} fichier{files.length > 1 ? 's' : ''} pret{files.length > 1 ? 's' : ''}
          </p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="text-xs shrink-0">({(f.size / 1024).toFixed(0)} Ko)</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="ml-auto text-destructive text-xs hover:underline shrink-0"
              >
                Retirer
              </button>
            </div>
          ))}
          {/* Add more files button */}
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            + Ajouter d'autres fichiers
          </button>
        </div>
      )}

      {/* Conversion errors */}
      {conversionErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            Certains fichiers n'ont pas pu etre convertis
          </div>
          {conversionErrors.map((err, i) => (
            <p key={i} className="text-xs text-destructive/80 ml-6">{err}</p>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleAnalyze}
        disabled={files.length === 0 || loading || converting}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Analyse de votre carte en cours...
          </>
        ) : (
          `Analyser ${files.length > 1 ? `mes ${files.length} fichiers` : 'ma carte'}`
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
