import sharp from "sharp";
import { AppError } from "./http";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export async function readImageBody(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new AppError(413, "Máximo 5 MB por imagen.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Selecciona una imagen.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new AppError(413, "Máximo 5 MB por imagen."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function optimizeProductImage(input: Buffer) {
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw new AppError(400, "Imagen vacía o demasiado grande.");
  try {
    const image = sharp(input, { limitInputPixels: 40000000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("format");
    return await image.rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new AppError(400, "Usa una imagen JPG, PNG o WebP válida, sin animación y de hasta 40 megapíxeles.");
  }
}
