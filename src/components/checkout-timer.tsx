"use client";
import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { CHECKOUT_CYCLE_MS, cycleSeconds, formatCountdown } from "@/lib/checkout-timer";
export function CheckoutTimer({ floatingEnabled = true }: { floatingEnabled?: boolean }) {
  const timerRef = useRef<HTMLElement>(null);
  const [floating, setFloating] = useState(false);
  const [seconds, setSeconds] = useState(CHECKOUT_CYCLE_MS / 1000);
  useEffect(() => {
    const now = Date.now();
    let start = now;
    try {
      const saved = Number(sessionStorage.getItem("tecnotop-checkout-cycle-v2"));
      if (Number.isFinite(saved) && saved > 0 && saved <= now) start = saved;
      else sessionStorage.setItem("tecnotop-checkout-cycle-v2", String(start));
    } catch { /* A blocked browser store must not prevent checkout. */ }
    const update = () => setSeconds(cycleSeconds(start, Date.now()));
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    const element = timerRef.current;
    if (!element || !floatingEnabled) return;
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      const headerHeight = 0;
      observer = new IntersectionObserver(([entry]) => {
        setFloating(!entry.isIntersecting && entry.boundingClientRect.bottom <= headerHeight);
      }, { rootMargin: "-" + headerHeight + "px 0px 0px 0px", threshold: 0 });
      observer.observe(element);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => { observer.disconnect(); window.removeEventListener("resize", observe); };
  }, [floatingEnabled]);
  return <><section ref={timerRef} className="checkout-countdown" aria-label="Temporizador del formulario">
    <div className="checkout-countdown-message"><Timer size={28} aria-hidden="true" /><strong>¡Aprovecha la oferta y haz tu pedido!</strong></div>
    <div className="checkout-clock" role="timer" aria-live="off" aria-label="Temporizador">{formatCountdown(seconds)}</div>
  </section>
    {floating && <aside className="checkout-floating-clock" aria-label="Temporizador flotante">
      <Timer size={17} aria-hidden="true" />
      <span className="floating-clock-value" role="timer" aria-live="off">{formatCountdown(seconds)}</span>
    </aside>}
  </>;
}
