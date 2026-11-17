"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  return <section className="product-gallery" aria-label={`Imágenes de ${name}`}>
    <div className="product-hero-image">
      {images.length ? <img src={images[selected]} alt={`${name}, imagen ${selected + 1}`} /> : <div className="product-no-image"><ImageIcon size={64} /><span>Imagen próximamente</span></div>}
    </div>
    {images.length > 1 && <div className="product-gallery-controls">
      <button type="button" aria-label="Imagen anterior" onClick={() => setSelected((selected + images.length - 1) % images.length)}><ChevronLeft /></button>
      <div className="product-thumbnails">{images.map((image, index) => <button type="button" key={`${image}-${index}`} aria-label={`Ver imagen ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={image} alt="" loading="lazy" /></button>)}</div>
      <button type="button" aria-label="Imagen siguiente" onClick={() => setSelected((selected + 1) % images.length)}><ChevronRight /></button>
    </div>}
  </section>;
}
