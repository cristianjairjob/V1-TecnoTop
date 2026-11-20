"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

export function ProductGallery({ images, name, stock }: { images: string[]; name: string; stock: number }) {
  const [selected, setSelected] = useState(0);
  const touch = useRef<{x:number;y:number}|null>(null);
  return <section className="product-gallery" aria-label={`Imágenes de ${name}`}>
    <div className="product-hero-image" onTouchStart={e => { touch.current = {x:e.touches[0].clientX,y:e.touches[0].clientY}; }} onTouchEnd={e => { const start=touch.current; touch.current=null; if (!start || images.length < 2) return; const dx=e.changedTouches[0].clientX-start.x, dy=e.changedTouches[0].clientY-start.y; if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)) setSelected(n=>(n+(dx<0?1:-1)+images.length)%images.length); }}>
      {stock > 0 && stock <= 10 && <span className="gallery-stock-alert">¡Últimas {stock} {stock === 1 ? "unidad" : "unidades"}!</span>}
      {images.length > 1 && <><button type="button" className="gallery-arrow prev" aria-label="Imagen anterior" onClick={()=>setSelected(n=>(n+images.length-1)%images.length)}><ChevronLeft /></button><button type="button" className="gallery-arrow next" aria-label="Imagen siguiente" onClick={()=>setSelected(n=>(n+1)%images.length)}><ChevronRight /></button></>}
      {images.length ? <img src={images[selected]} alt={`${name}, imagen ${selected + 1}`} /> : <div className="product-no-image"><ImageIcon size={64} /><span>Imagen próximamente</span></div>}
    </div>
    {images.length > 1 && <div className="product-gallery-controls">
      <div className="product-thumbnails">{images.map((image, index) => <button type="button" key={`${image}-${index}`} aria-label={`Ver imagen ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={image} alt="" loading="lazy" /></button>)}</div>
    </div>}
  </section>;
}
