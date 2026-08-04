// Client-only helper: downscale an uploaded image and turn it into a base64
// JPEG data URL for storage — the app has no object storage (S3/Blob/
// Cloudinary), so photos are stored as data URLs directly in Postgres.
// Extracted from the 3 near-identical copies that existed in PlaceForm,
// ImagesManager and FestivalImagesManager.

export interface ResizeOptions {
  maxDim?: number;
  quality?: number;
}

export function resizeImageToDataUrl(file: File, opts: ResizeOptions = {}): Promise<string> {
  const { maxDim = 1280, quality = 0.78 } = opts;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
