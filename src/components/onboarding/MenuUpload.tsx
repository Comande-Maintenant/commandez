import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Camera, Loader2, FileText, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { analyzeMenuImages } from '@/services/menu-analysis';
import { extractColors } from '@/services/color-extraction';
import { convertFilesForAnalysis } from '@/utils/file-converter';
import type { AnalyzedMenu, ExtractedColors } from '@/types/onboarding';

const LOADING_MESSAGES = [
  "Nous analysons votre carte pour vous faire gagner du temps...",
  "Notre IA structure vos plats, categories et prix...",
  "Vous n'aurez plus qu'a verifier et ajuster si necessaire.",
  "Preparation de votre menu numerique en cours...",
  "Encore un instant, nous mettons en forme vos categories...",
  "Bientot pret ! Votre carte digitale prend forme...",
];

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
  const [messageIndex, setMessageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Rotate loading messages every 4s
  useEffect(() => {
    if (!loading) {
      setMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

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
    <div className="space-y-4 relative">
      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-col items-center gap-5 px-6 max-w-sm text-center">
              {/* Spinner */}
              <Loader2 className="h-10 w-10 animate-spin text-primary" />

              {/* Fake progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    animation: 'fakeProgress 15s ease-out forwards',
                  }}
                />
              </div>

              {/* Rotating message */}
              <div className="h-12 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={messageIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-foreground font-medium"
                  >
                    {LOADING_MESSAGES[messageIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Fixed warning */}
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3 w-full">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Ne quittez pas cette page, l'analyse est en cours.</span>
              </div>

              {/* Fixed tip */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Pensez a verifier les prix et les descriptions une fois l'analyse terminee.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for fake progress animation */}
      <style>{`
        @keyframes fakeProgress {
          0% { width: 0%; }
          30% { width: 35%; }
          60% { width: 60%; }
          80% { width: 78%; }
          100% { width: 90%; }
        }
      `}</style>

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
            Analyse en cours...
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
