import { useState } from 'react';
import { Sparkles, Info } from 'lucide-react';
import type { ExtractedColors } from '@/types/onboarding';
import { useLanguage } from '@/context/LanguageContext';

interface QuickColorPickerProps {
  extractedColors?: ExtractedColors;
  primaryColor: string;
  bgColor: string;
  onPrimaryChange: (color: string) => void;
  onBgChange: (color: string) => void;
}

function ColorSwatch({
  color,
  selected,
  label,
  recommended,
  recommendedLabel,
  onClick,
}: {
  color: string;
  selected: boolean;
  label?: string;
  recommended?: boolean;
  recommendedLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        selected ? 'border-foreground ring-2 ring-foreground/20' : 'border-border hover:border-foreground/30'
      }`}
    >
      <div
        className="w-6 h-6 rounded-full border border-border"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-foreground">{label ?? color}</span>
      {recommended && recommendedLabel && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
          <Sparkles className="h-3 w-3" />
          {recommendedLabel}
        </span>
      )}
    </button>
  );
}

export function QuickColorPicker({
  extractedColors,
  primaryColor,
  bgColor,
  onPrimaryChange,
  onBgChange,
}: QuickColorPickerProps) {
  const { t } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);

  const primaryOptions = extractedColors
    ? [extractedColors.primary, extractedColors.secondary, ...extractedColors.palette.slice(0, 1)]
    : ['#000000', '#1a1a2e', '#16213e'];

  const bgOptions = extractedColors
    ? [extractedColors.background, '#ffffff', '#fafafa']
    : ['#ffffff', '#fafafa', '#f5f5f5'];

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div
        className="rounded-xl p-6 border border-border transition-colors"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div>
            <p className="font-bold" style={{ color: primaryColor }}>{t('onboarding.colors.preview_name')}</p>
            <p className="text-sm opacity-60" style={{ color: primaryColor }}>{t('onboarding.colors.live_preview')}</p>
          </div>
        </div>
        <div
          className="inline-block px-4 py-2 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {t('onboarding.colors.order_button')}
        </div>
      </div>

      {/* Tooltip for extracted colors */}
      {extractedColors && (
        <div className="relative">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            {t('onboarding.colors.extracted_tooltip')}
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full mt-1 z-10 bg-card border border-border rounded-lg p-3 shadow-lg max-w-xs">
              <p className="text-xs text-muted-foreground">
                {t('onboarding.colors.extracted_desc')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Primary color */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t('onboarding.colors.primary')}</p>
        <div className="flex flex-wrap gap-2">
          {primaryOptions.map((c, i) => (
            <ColorSwatch
              key={c + i}
              color={c}
              selected={primaryColor === c}
              recommended={i === 0 && !!extractedColors}
              recommendedLabel={t('onboarding.colors.recommended')}
              onClick={() => onPrimaryChange(c)}
            />
          ))}
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-foreground/30">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="w-6 h-6 rounded-full border-0 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{t('onboarding.colors.custom')}</span>
          </label>
        </div>
      </div>

      {/* Background color */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t('onboarding.colors.background')}</p>
        <div className="flex flex-wrap gap-2">
          {bgOptions.map((c, i) => (
            <ColorSwatch
              key={c + i}
              color={c}
              selected={bgColor === c}
              recommended={i === 0 && !!extractedColors}
              recommendedLabel={t('onboarding.colors.recommended')}
              onClick={() => onBgChange(c)}
            />
          ))}
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-foreground/30">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => onBgChange(e.target.value)}
              className="w-6 h-6 rounded-full border-0 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{t('onboarding.colors.custom')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
