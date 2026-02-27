import type { ExtractedColors } from '@/types/onboarding';

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
  onClick,
}: {
  color: string;
  selected: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        selected ? 'border-foreground ring-2 ring-foreground/20' : 'border-border hover:border-foreground/30'
      }`}
    >
      <div
        className="w-6 h-6 rounded-full border border-border"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-foreground">{label ?? color}</span>
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
            <p className="font-bold" style={{ color: primaryColor }}>Votre Restaurant</p>
            <p className="text-sm opacity-60" style={{ color: primaryColor }}>Apercu en temps reel</p>
          </div>
        </div>
        <div
          className="inline-block px-4 py-2 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Commander
        </div>
      </div>

      {/* Primary color */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Couleur principale</p>
        <div className="flex flex-wrap gap-2">
          {primaryOptions.map((c, i) => (
            <ColorSwatch
              key={c + i}
              color={c}
              selected={primaryColor === c}
              label={i === 0 && extractedColors ? 'Recommande' : undefined}
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
            <span className="text-sm text-muted-foreground">Personnalise</span>
          </label>
        </div>
      </div>

      {/* Background color */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Couleur de fond</p>
        <div className="flex flex-wrap gap-2">
          {bgOptions.map((c, i) => (
            <ColorSwatch
              key={c + i}
              color={c}
              selected={bgColor === c}
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
            <span className="text-sm text-muted-foreground">Personnalise</span>
          </label>
        </div>
      </div>
    </div>
  );
}
