"use client";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cycleSeconds, formatCountdown } from "@/lib/checkout-timer";
export function CheckoutTimer() {
  const [seconds, setSeconds] = useState(7200);
  useEffect(() => {
    const now = Date.now();
    let start = now;
    try {
      const saved = Number(sessionStorage.getItem("tecnotop-checkout-cycle"));
      if (Number.isFinite(saved) && saved > 0 && saved <= now) start = saved;
      else sessionStorage.setItem("tecnotop-checkout-cycle", String(start));
    } catch { /* A blocked browser store must not prevent checkout. */ }
    const update = () => setSeconds(cycleSeconds(start, Date.now()));
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);
  return <section className="checkout-countdown" aria-label="Temporizador del formulario">
    <div className="checkout-countdown-message"><Timer size={28} aria-hidden="true" /><strong>¡Aprovecha la oferta y haz tu pedido!</strong></div>
    <div className="checkout-clock" role="timer" aria-live="off" aria-label="Reloj de dos horas">{formatCountdown(seconds)}</div>
    <small>Ciclo de 2 horas · Se reinicia automáticamente. No modifica el precio.</small>
  </section>;
}
