/**
 * Convert any file (HEIC, MOV, SVG, BMP, TIFF, etc.) to a format
 * that Claude's vision API can process (JPEG/PNG/WebP/GIF).
 * PDFs are kept as-is.
 */
// Lazy-loaded to avoid adding ~1.3MB to main bundle
let heic2anyModule: typeof import('heic2any') | null = null;
async function getHeic2any() {
  if (!heic2anyModule) {
    heic2anyModule = await import('heic2any');
  }
  return heic2anyModule.default;
}

const PASSTHROUGH_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const HEIC_TYPES = ['image/heic', 'image/heif'];

function isVideo(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mov|mp4|avi|webm|mkv)$/i.test(file.name);
}

function isHeic(file: File): boolean {
  return (
    HEIC_TYPES.includes(file.type.toLowerCase()) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

function isSvg(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(bmp|tiff?|ico|jfif)$/i.test(file.name);
}

/**
 * Convert HEIC/HEIF to JPEG. First tries native browser support via canvas,
 * falls back to heic2any library.
 */
async function convertHeic(file: File): Promise<File> {
  // Try native browser support (Safari, Chrome 124+)
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
    );
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  } catch {
    // Fallback to heic2any library
  }

  const heic2any = await getHeic2any();
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const result = Array.isArray(blob) ? blob[0] : blob;
  return new File([result], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
    type: 'image/jpeg',
  });
}

/**
 * Extract a frame from a video file (MOV, MP4, etc.) as JPEG.
 * Seeks to 0.5s to skip potential black frames at the start.
 */
async function extractVideoFrame(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error(`Impossible de lire le fichier video: ${file.name}`));
    });

    video.addEventListener('loadeddata', () => {
      // Seek to 0.5s or middle if short
      video.currentTime = Math.min(0.5, video.duration / 2);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error('Extraction de frame echouee'));
              return;
            }
            const ext = file.name.replace(/\.[^.]+$/, '.jpg');
            resolve(new File([blob], ext, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.92
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

/**
 * Render SVG to PNG via canvas.
 */
async function convertSvg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Use at least 1200px wide for good quality
        const scale = Math.max(1, 1200 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Conversion SVG echouee'));
              return;
            }
            resolve(
              new File([blob], file.name.replace(/\.svg$/i, '.png'), {
                type: 'image/png',
              })
            );
          },
          'image/png'
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('SVG invalide'));
      };
      img.src = url;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Convert any other image format (BMP, TIFF, etc.) to JPEG via canvas.
 */
async function convertGenericImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
  );
  const newName = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
}

/**
 * Convert a file to a format Claude can process.
 * Returns the original file if already compatible.
 */
export async function convertFileForAnalysis(file: File): Promise<File> {
  // Already compatible - pass through
  if (PASSTHROUGH_TYPES.includes(file.type)) {
    return file;
  }

  // HEIC/HEIF
  if (isHeic(file)) {
    return convertHeic(file);
  }

  // Video (MOV, MP4, etc.) - extract a frame
  if (isVideo(file)) {
    return extractVideoFrame(file);
  }

  // SVG
  if (isSvg(file)) {
    return convertSvg(file);
  }

  // Any other image format (BMP, TIFF, etc.)
  if (isImage(file)) {
    return convertGenericImage(file);
  }

  // Unknown format - try generic image conversion as last resort
  try {
    return await convertGenericImage(file);
  } catch {
    // Return as-is, let the upload/analysis handle the error
    return file;
  }
}

/**
 * Convert multiple files in parallel.
 * Returns converted files + any errors.
 */
export async function convertFilesForAnalysis(
  files: File[]
): Promise<{ converted: File[]; errors: string[] }> {
  const converted: File[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(
    files.map((f) => convertFileForAnalysis(f))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      converted.push(result.value);
    } else {
      errors.push(`${files[i].name}: ${result.reason?.message || 'Conversion echouee'}`);
    }
  }

  return { converted, errors };
}
