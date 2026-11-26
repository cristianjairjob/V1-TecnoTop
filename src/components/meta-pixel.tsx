"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { initMetaPixel, metaConsent, metaPageView, setMetaConsent, subscribeMetaConsent } from "@/lib/meta-browser";

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const path = usePathname();
  const consent = useSyncExternalStore(subscribeMetaConsent, metaConsent, () => "");
  const [editing, setEditing] = useState(false);
  const lastView = useRef("");
  const enabled = /^\d+$/.test(pixelId) && !path.startsWith("/admin");
  useEffect(() => {
    if (!enabled || consent !== "accepted") { window.fbq?.("consent", "revoke"); lastView.current = ""; return; }
    initMetaPixel(pixelId);
    if (lastView.current !== path) { metaPageView(); lastView.current = path; }
  }, [enabled, consent, path, pixelId]);
  if (!enabled) return null;
  if (consent && !editing) return <button type="button" className="meta-privacy-link" onClick={() => setEditing(true)}>Preferencias de privacidad</button>;
  return <aside className="meta-consent" aria-label="Preferencias de medición publicitaria">
    <strong>Medición publicitaria</strong>
    <p>Con tu autorización usamos cookies de Meta y compartimos datos de navegación y compra, incluidos datos de contacto transformados mediante hash, para medir nuestros anuncios. Puedes comprar sin aceptar y cambiar tu elección aquí.</p>
    <Link href="/politicas#privacidad">Política de privacidad</Link>
    <div><button type="button" onClick={() => { setMetaConsent(false); setEditing(false); }}>Rechazar</button><button type="button" className="button" onClick={() => { setMetaConsent(true); setEditing(false); }}>Aceptar</button></div>
  </aside>;
}
