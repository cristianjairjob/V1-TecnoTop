"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
const subscribe = () => () => {};
export function Confirmation() {
  const raw = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem("tecnotop-confirmation") || "",
    () => "",
  );
  let order: { number: string } | null = null;
  try {
    order = raw ? JSON.parse(raw) : null;
  } catch {}
  return (
    <div className="empty-state confirmation">
      <CheckCircle2 size={48} />
      <h1>{order ? "Recibimos tu pedido" : "Consulta tu pedido"}</h1>
      {order ? (
        <>
          <p>Tu número TecnoTop es</p>
          <strong className="order-number">{order.number}</strong>
          <p>
            Recibido para validación. Consulta el seguimiento para ver los
            avances reales.
          </p>
        </>
      ) : (
        <p>Ingresa tu número de pedido y celular para consultar su estado.</p>
      )}
      <Link href="/seguimiento" className="button">
        Seguir mi pedido
      </Link>
    </div>
  );
}
