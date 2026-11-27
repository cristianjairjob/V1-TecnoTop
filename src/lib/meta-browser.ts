"use client";
import type { MetaContext, MetaEventName } from "./meta-schema";

type Fbq = ((...args: unknown[]) => void) & { queue: unknown[][]; loaded: boolean; version: string; callMethod?: (...args: unknown[]) => void; push?: Fbq };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }
const consentKey = "tecnotop-meta-consent-v1";
let pixelId = "";
let memoryConsent = "";
let storageFailed = false;
const fired = new Set<string>();
export function metaPreference(): string {
  try { const value = localStorage.getItem(consentKey); return value === "accepted" || value === "declined" ? value : storageFailed ? memoryConsent : ""; } catch { return memoryConsent; }
}
// Opt-out: no stored decision is active; an explicit rejection always wins.
export function metaConsent(): string { return metaPreference() === "declined" ? "declined" : "accepted"; }
export function showMetaBanner(path: string, preference: string) { return path === "/" && !preference; }
export function subscribeMetaConsent(listener: () => void) {
  window.addEventListener("tecnotop-meta-consent", listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener("tecnotop-meta-consent", listener); window.removeEventListener("storage", listener); };
}
export function setMetaConsent(accepted: boolean) {
  memoryConsent = accepted ? "accepted" : "declined";
  try { localStorage.setItem(consentKey, memoryConsent); storageFailed = false; } catch { storageFailed = true; }
  if (!accepted) {
    window.fbq?.("consent", "revoke");
    try {
      for (const name of ["_fbp", "_fbc"]) {
        for (const domain of ["", `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
      }
    } catch { /* Cookie storage can be disabled independently of consent storage. */ }
  }
  window.dispatchEvent(new Event("tecnotop-meta-consent"));
}
export function readMetaCookie(name: "_fbp" | "_fbc") {
  try {
    const raw = document.cookie.split(";").map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
    if (!raw) return undefined;
    const value = decodeURIComponent(raw); return /^fb\.\d+\.\d+\.[\w-]+$/.test(value) && value.length <= (name === "_fbp" ? 250 : 500) ? value : undefined;
  } catch { return undefined; }
}
export function initMetaPixel(id: string) {
  pixelId = /^\d+$/.test(id) ? id : "";
  if (!pixelId || metaConsent() !== "accepted") return;
  if (!window.fbq) {
    const queue = function (...args: unknown[]) { if (queue.callMethod) queue.callMethod(...args); else queue.queue.push(args); } as Fbq;
    queue.queue = []; queue.loaded = true; queue.version = "2.0"; queue.push = queue;
    window.fbq = queue; window._fbq = queue;
    // Do not enable automatic events or automatic advanced matching.
    queue("set", "autoConfig", false, pixelId);
    queue("consent", "grant");
    queue("init", pixelId);
    const script = document.createElement("script");
    script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.onerror = () => console.warn("[meta-pixel] SCRIPT_BLOCKED: revisar CSP, bloqueadores o conexión.");
    document.head.appendChild(script);
  } else window.fbq("consent", "grant");
  const click = new URL(location.href).searchParams.get("fbclid");
  if (click && /^[\w-]{1,400}$/.test(click) && !readMetaCookie("_fbc")) {
    try { document.cookie = `_fbc=fb.1.${Date.now()}.${click}; Max-Age=7776000; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* No fabricated fallback cookie. */ }
  }
}
export function metaContext(eventId = crypto.randomUUID()): MetaContext | null {
  if (!pixelId || metaConsent() !== "accepted") return null;
  return { consent: true, event_id: eventId, event_source_url: `${location.origin}${location.pathname}`, fbp: readMetaCookie("_fbp"), fbc: readMetaCookie("_fbc") };
}
export function metaPageView() {
  if (pixelId && metaConsent() === "accepted") window.fbq?.("track", "PageView");
}
export async function trackMetaAction(name: MetaEventName, eventId: string, extras: { person?: { email?: string; phone: string; firstName: string; lastName: string }; receipt?: string; value?: number } = {}) {
  try {
    const context = metaContext(eventId);
    if (!context) return;
    const key = `${name}:${eventId}`;
    const custom = name === "Purchase" ? { currency: "COP", value: extras.value } : {};
    let alreadyFired = fired.has(key);
    try { alreadyFired ||= sessionStorage.getItem(`meta-fired:${key}`) === "1"; } catch {}
    if (!alreadyFired && window.fbq) {
      window.fbq("track", name, custom, { eventID: eventId });
      fired.add(key);
      try { sessionStorage.setItem(`meta-fired:${key}`, "1"); } catch {}
    }
    // No personal details in fbq. Matching data goes only to our same-origin server for hashing.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (metaConsent() !== "accepted") return;
      try {
        const response = await fetch("/api/meta-capi", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ ...context, event_name: name, ...(extras.person ? { person: extras.person } : {}), ...(extras.receipt ? { receipt: extras.receipt } : {}) }),
        });
        if (response.ok) return;
        console.warn("[meta-capi] HTTP_ERROR", response.status);
        if (response.status < 500) return;
      } catch { console.warn("[meta-capi] NETWORK_ERROR"); }
    }
  } catch { /* Storage/privacy settings and blockers must never break checkout. */ }
}
