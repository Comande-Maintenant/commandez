import ColorThief from 'colorthief';
import type { ExtractedColors } from '@/types/onboarding';

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function extractColors(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 6) as [number, number, number][];

        if (!palette || palette.length < 3) {
          resolve({
            primary: '#000000',
            secondary: '#333333',
            background: '#ffffff',
            palette: ['#000000', '#333333', '#ffffff'],
          });
          return;
        }

        // Sort by luminance
        const sorted = [...palette].sort(
          (a, b) => luminance(...a) - luminance(...b)
        );

        const darkest = sorted[0];
        const second = sorted[1];
        const lightest = sorted[sorted.length - 1];

        // If lightest is too dark, use white
        const bgColor =
          luminance(...lightest) > 200
            ? lightest
            : ([255, 255, 255] as [number, number, number]);

        resolve({
          primary: rgbToHex(...darkest),
          secondary: rgbToHex(...second),
          background: rgbToHex(...bgColor),
          palette: palette.map((c) => rgbToHex(...c)),
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for color extraction'));
    img.src = imageUrl;
  });
}
