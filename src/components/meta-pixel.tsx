"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { initMetaPixel, metaPreference, metaPageView, setMetaConsent, showMetaBanner, subscribeMetaConsent } from "@/lib/meta-browser";

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const path = usePathname();
  const preference = useSyncExternalStore(subscribeMetaConsent, metaPreference, () => "");
  const lastView = useRef("");
  const enabled = /^\d+$/.test(pixelId) && !path.startsWith("/admin");
  useEffect(() => {
    if (!enabled || preference === "declined") { window.fbq?.("consent", "revoke"); lastView.current = ""; return; }
    initMetaPixel(pixelId);
    if (lastView.current !== path) { metaPageView(); lastView.current = path; }
  }, [enabled, preference, path, pixelId]);
  if (!enabled || !showMetaBanner(path, preference)) return null;
  return <aside className="meta-consent" aria-label="Preferencias de medición publicitaria">
    <strong>Medición publicitaria</strong>
    <p>Usamos cookies de Meta y compartimos datos de navegación y compra, incluidos datos de contacto transformados mediante hash, para medir nuestros anuncios desde tu primera visita. Puedes rechazar esta medición sin afectar tu compra.</p>
    <Link href="/politicas#privacidad">Política de privacidad</Link>
    <div><button type="button" onClick={() => setMetaConsent(false)}>Rechazar / No</button><button type="button" className="button" onClick={() => setMetaConsent(true)}>Aceptar</button></div>
  </aside>;
}
