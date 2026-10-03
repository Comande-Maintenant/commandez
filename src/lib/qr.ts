// Keep QR modules dark enough against the fixed white background, including
// merchants whose visual theme uses white, transparent or malformed colors.
export function readableQrColor(color: string): string {
  const hex = /^#[0-9a-f]{3}$/i.test(color)
    ? `#${color.slice(1).split('').map(character => character + character).join('')}`
    : color;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#000000';
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5 ? hex : '#000000';
}
