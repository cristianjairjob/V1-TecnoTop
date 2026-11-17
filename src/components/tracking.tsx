"use client";
import { useState } from "react";
import { PackageSearch } from "lucide-react";
type TrackingData = {
  number: string;
  events: { status: string; detail: string; date: string }[];
  shipments: { guide: string | null; carrier: string | null }[];
};
export function Tracking() {
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setData(null);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: String(f.number).trim().toUpperCase(),
          phone: f.phone,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible consultar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tracking-layout">
      <form onSubmit={submit} className="panel">
        <PackageSearch size={32} />
        <h2>Encuentra tu pedido</h2>
        <p>Usa el número TecnoTop y el celular registrado en tu compra.</p>
        <label>
          Número de pedido
          <input
            name="number"
            placeholder="TT-XXXXXXXXXXXX"
            required
            maxLength={15}
          />
        </label>
        <label>
          Celular de la compra
          <input name="phone" type="tel" placeholder="300 123 4567" required />
        </label>
        <button className="button full" disabled={busy}>
          {busy ? "Consultando…" : "Consultar pedido"}
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
      <div>
        {data ? (
          <div className="panel">
            <span className="eyebrow">{data.number}</span>
            <h2>Así va tu pedido</h2>
            <ol className="timeline">
              {data.events.map((e, i) => (
                <li key={i}>
                  <strong>{e.detail}</strong>
                  <time>
                    {new Date(e.date).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                    })}
                  </time>
                </li>
              ))}
            </ol>
            {data.shipments.map((s, i) => (
              <p key={i}>
                Guía: {s.guide || "Pendiente"} ·{" "}
                {s.carrier || "Transportadora pendiente"}
              </p>
            ))}
          </div>
        ) : (
          <div className="tracking-info">
            <h2>Cada avance, en un solo lugar.</h2>
            <p>
              Aquí encontrarás únicamente los eventos registrados de tu pedido,
              desde la recepción hasta la entrega.
            </p>
            <p>Si necesitas ayuda, contáctanos con tu número de pedido.</p>
          </div>
        )}
      </div>
    </div>
  );
}
