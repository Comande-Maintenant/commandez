declare module "colorthief/dist/color-thief.mjs" {
  type RGBColor = [number, number, number];
  type ImageSource =
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageData
    | ImageBitmap;

  export default class ColorThief {
    getColor(source: ImageSource): RGBColor | null;
    getPalette(source: ImageSource, colorCount?: number): RGBColor[] | null;
  }
}
