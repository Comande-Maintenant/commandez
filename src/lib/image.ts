const MAX_WIDTH = 1200;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Validate file size. Returns error message or null if OK.
 */
export function validateImageSize(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) {
    return "L'image depasse 2 Mo. Veuillez choisir une image plus legere.";
  }
  return null;
}

/**
 * Resize image to max 1200px wide before upload.
 * Returns a new File with the resized image.
 */
export function resizeImage(file: File, maxWidth = MAX_WIDTH): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }
      const ratio = maxWidth / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
