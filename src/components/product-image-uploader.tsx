"use client";
import { useRef, useState } from "react";

export function ProductImageUploader({ productId, value, onChange, onBusy, title = "Imágenes del producto", maxFiles = 15, disabled = false }: {
  productId: string; value: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void; title?: string; maxFiles?: number; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = value.split("\n").map(s => s.trim()).filter(Boolean);
  async function upload(files: FileList | File[]) {
    if (lock.current || disabled) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    if (urls.length + selected.length > maxFiles) { setMessage(`Este bloque admite hasta ${maxFiles} imágenes.`); return; }
    if (selected.some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      setMessage("Usa JPG, PNG o WebP de hasta 5 MB por archivo."); return;
    }
    lock.current = true; setBusy(true); onBusy(true); setMessage("Subiendo imágenes…");
    const added = [...urls];
    try {
      for (const file of selected) {
        const response = await fetch(`/api/admin/product-images?productId=${encodeURIComponent(productId)}`, {
          method: "POST", headers: { "Content-Type": file.type }, body: file,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo subir la imagen.");
        added.push(result.url); onChange(added.join("\n"));
      }
      setMessage("Imágenes subidas. Pulsa Guardar para actualizar este bloque del producto.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error al subir. Puedes volver a intentarlo."); }
    finally { lock.current = false; setBusy(false); onBusy(false); if (input.current) input.current.value = ""; }
  }
  return <section className="product-image-uploader span-two" aria-label={title}>
    <h3>{title}</h3>
    <p>Recomendado: <strong>1600 × 1600 píxeles</strong>, con el producto centrado. Usa la misma proporción en toda la galería. JPG, PNG o WebP · Máximo 5 MB por archivo y {maxFiles} {maxFiles === 1 ? "imagen" : "imágenes"}.</p>
    <div className={`image-dropzone ${dragging ? "is-dragging" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}>
      <strong>{busy ? "Subiendo y optimizando…" : "Arrastra tus imágenes aquí"}</strong>
      <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()}>Seleccionar archivos</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={maxFiles > 1} hidden disabled={busy} onChange={e => { if (e.target.files) void upload(e.target.files); }} />
    </div>
    <p role="status">{message}</p>
    <div className="admin-image-previews">{urls.map((url, i) => <div key={`${i}-${url}`}>
      <img src={url} alt={`Imagen ${i + 1} del producto`} width={96} height={96} />
      <small>{i === 0 ? "Principal" : `Imagen ${i + 1}`}</small>
      <button type="button" disabled={busy} onClick={() => onChange(urls.filter((_, n) => n !== i).join("\n"))}>Quitar</button>
    </div>)}</div>
    <label>{maxFiles === 1 ? "URL de la imagen (opcional)" : "URLs de imágenes (una por línea; la primera será la principal)"}<textarea disabled={busy} rows={4} value={value} onChange={e => onChange(e.target.value)} /></label>
  </section>;
}
