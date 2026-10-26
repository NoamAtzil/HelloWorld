// Browser-side image helpers (canvas). Never import from server code.

// Shrink a photo to a JPEG that fits both a pixel and a byte budget. If the
// browser can't decode the file, return it unchanged and let the server
// report the problem.
export async function downscale(file: File, maxDimension: number, maxBytes: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.55, 0.85 - attempt * 0.1);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) return file;
      if (blob.size <= maxBytes || attempt === 3) {
        return new File([blob], "photo.jpg", { type: "image/jpeg" });
      }
      scale *= 0.8;
    }
    return file;
  } catch {
    return file;
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
