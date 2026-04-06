import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Camera, Loader2, FileText, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { analyzeMenuImages } from '@/services/menu-analysis';
import { extractColors } from '@/services/color-extraction';
import { convertFilesForAnalysis, translateError } from '@/utils/file-converter';
import { useLanguage } from '@/context/LanguageContext';
import type { AnalyzedMenu, ExtractedColors } from '@/types/onboarding';

interface MenuUploadProps {
  onAnalysisComplete: (menu: AnalyzedMenu, colors?: ExtractedColors) => void;
  onSkip: () => void;
}

export function MenuUpload({ onAnalysisComplete, onSkip }: MenuUploadProps) {
  const { t } = useLanguage();

  const LOADING_MESSAGES = [
    t('onboarding.upload.loading_1'),
    t('onboarding.upload.loading_2'),
    t('onboarding.upload.loading_3'),
    t('onboarding.upload.loading_4'),
    t('onboarding.upload.loading_5'),
    t('onboarding.upload.loading_6'),
  ];

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
      setError(t('onboarding.upload.conversion_error'));
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
      setError(t('onboarding.upload.analysis_error'));
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
                <span>{t('onboarding.upload.dont_leave')}</span>
              </div>

              {/* Fixed tip */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{t('onboarding.upload.check_prices')}</span>
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
          {t('onboarding.upload.drop_title')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('onboarding.upload.drop_desc')}
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
        {t('onboarding.upload.take_photo')}
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
          {t('onboarding.upload.converting')}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('onboarding.upload.files_ready', { count: files.length })}
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
                {t('onboarding.upload.remove')}
              </button>
            </div>
          ))}
          {/* Add more files button */}
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            {t('onboarding.upload.add_more')}
          </button>
        </div>
      )}

      {/* Conversion errors */}
      {conversionErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            {t('onboarding.upload.conversion_failed')}
          </div>
          {conversionErrors.map((err, i) => (
            <p key={i} className="text-xs text-destructive/80 ml-6">{translateError(err, t)}</p>
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
            {t('onboarding.upload.analyzing')}
          </>
        ) : (
          files.length > 1
            ? t('onboarding.upload.analyze_files', { count: files.length })
            : t('onboarding.upload.analyze_menu')
        )}
      </Button>

      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('onboarding.upload.manual_create')}
      </button>
    </div>
  );
}
