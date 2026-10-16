/**
 * Verkleinert Handyfotos im Browser, bevor sie hochgeladen werden.
 * Ein 12-Megapixel-Foto hat oft 4–8 MB – Vercel erlaubt aber nur 4,5 MB pro
 * Anfrage. Für die Texterkennung reichen ca. 2400 Pixel an der langen Seite.
 */

const MAX_EDGE = 2400;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Bild konnte nicht verarbeitet werden.");
  context.fillStyle = "#fff"; // transparente PNGs bekommen weißen Hintergrund
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      return new File([blob], "dokument.jpg", { type: "image/jpeg" });
    }
  }
  throw new Error("Das Bild ist auch nach dem Verkleinern zu groß.");
}
