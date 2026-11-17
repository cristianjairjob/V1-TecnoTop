"use client";
import { useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
export function CollectionCarousel({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  function scroll(direction: number) {
    track.current?.scrollBy({
      left: direction * track.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <div>
      <div className="carousel-controls">
        <button
          onClick={() => scroll(-1)}
          aria-label={`Ver productos anteriores de ${name}`}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label={`Ver siguientes productos de ${name}`}
        >
          <ArrowRight size={18} />
        </button>
      </div>
      <div className="product-grid" ref={track}>
        {children}
      </div>
    </div>
  );
}
