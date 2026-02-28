const MAX_WIDTH = 1200;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MENU_MAX_SIZE = 400;

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

/**
 * Resize image for menu items: max 400px on the largest side, exported as webp.
 * Returns a Blob ready for upload.
 */
export function resizeImageForMenu(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = Math.max(img.width, img.height);
      const ratio = maxSide > MENU_MAX_SIZE ? MENU_MAX_SIZE / maxSide : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/webp",
        0.82
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = URL.createObjectURL(file);
  });
}
