"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/catalog-format";
import { AdminOrderDetail } from "./admin-order-detail";
import { useRouter } from "next/navigation";
import { commercialStatuses } from "@/lib/order-management";
export type Order = { id: string; number: string; createdAt: string; status: string; customer: { name: string; phone: string; email: string }; address: { state: string; city: string; address: string; complement?: string; buyer?: { firstName: string; lastName: string }; delivery?: { additionalNotes?: string; requestedDate?: string; establishment?: string; reference?: string } }; items: { id: string; name: string; quantity: number; unitPrice: string; snapshot: { variant?: string; colors?: string[]; offer?: string } }[]; subtotal: string; discount: string; shipping: string; total: string; pricingSnapshot?: { isTest?: boolean; baseSubtotal: number; savings: number }; promotionCode: string | null; paymentMethod: string; events: { id: string; status: string; detail: string; createdAt: string }[] };
type Audit = { id: string; action: string; createdAt: string };
const date = (s: string) => new Date(s).toLocaleString("es-CO", { timeZone: "America/Bogota" });
export function AdminOrders({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]), [history, setHistory] = useState<Audit[]>([]);
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [sort, setSort] = useState("desc"), [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  async function act(o: Order, remove = false) {
    if (actionId) return;
    if (remove && !window.confirm(`¿Eliminar definitivamente el pedido ${o.number} y sus productos asociados? Esta acción no se puede deshacer y no devuelve stock.`)) return;
    setActionId(o.id); setError("");
    try {
      const nextStatus = o.status === "DESPACHADO" ? "PENDIENTE" : "DESPACHADO";
      const response = await fetch("/api/admin/pedidos", { method: remove ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remove ? { id: o.id, confirm: true } : { id: o.id, expectedStatus: o.status, status: nextStatus }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se guardó el cambio.");
      setOrders(current => remove ? current.filter(row => row.id !== o.id) : current.map(row => row.id === o.id ? { ...row, status: data.status } : row).filter(row => !status || row.status === status));
      if (remove && orderId) router.replace("/admin/pedidos");
      setRevision(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo modificar el pedido."); }
    finally { setActionId(null); }
  }
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ q, status, sort, page: String(page), ...(orderId ? { id: orderId } : {}) });
        const response = await fetch(`/api/admin/pedidos?${query}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        setOrders(data.orders); setHistory(data.history); setError("");
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudieron cargar los pedidos."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, status, sort, page, revision, orderId]);
  const order = orders[0];
  return <div className="wrap page-section">
    <p><Link href="/admin">← Administración</Link> · <Link href="/admin/configuracion/notificaciones">Telegram y activación</Link></p>
    <h1>{orderId ? "Detalle del pedido" : "Pedidos"}</h1>
    {error && <p role="alert" className="form-error">{error}</p>}
    {loading && <p role="status">Cargando…</p>}
    {!orderId ? <>
      <div className="form-grid"><label>Buscar número, nombre o teléfono<input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></label>
        <label>Estado<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Todos</option>{[...commercialStatuses, "VALIDANDO", "ENVIANDO_A_DROPI", "ACEPTADO_POR_DROPI", "ERROR_DROPI", "GUIA_GENERADA", "EN_TRANSITO", "EN_REPARTO", "DEVUELTO"].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Orden por fecha<select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select></label>
      </div>
      <div className="admin-orders-scroll" tabIndex={0} role="region" aria-label="Tabla de pedidos; desplaza horizontalmente para ver todas las columnas"><table className="admin-orders-table"><thead><tr>{["Pedido / fecha", "Cliente / teléfono", "Ciudad", "Productos / cantidades", "Total", "Pago", "Estado", "Acciones"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{orders.map(o => <tr key={o.id} aria-busy={actionId === o.id}>
        <td><Link href={`/admin/pedidos/${o.id}`}>{o.number}</Link>{o.pricingSnapshot?.isTest && <span className="order-badge order-test">PRUEBA</span>}<small>{date(o.createdAt)}</small></td><td><strong>{o.customer.name}</strong><small>{o.customer.phone}</small></td><td>{o.address.city}</td><td>{o.items.map(i => <div key={i.id}>{i.quantity} × {i.name}</div>)}</td><td className="order-total">{money(Number(o.total))}</td><td><span className="order-badge order-payment">{o.paymentMethod}</span></td><td><span className={`order-badge ${o.status === "PENDIENTE" ? "order-pending" : o.status === "DESPACHADO" ? "order-dispatched" : "order-other"}`}>{o.status}</span></td>
        <td><div className="order-actions"><button type="button" disabled={Boolean(actionId) || loading} onClick={() => void act(o)}>{o.status === "DESPACHADO" ? "Volver a pendiente" : "Marcar despachado"}</button><button type="button" className="order-delete" disabled={Boolean(actionId) || loading} onClick={() => void act(o, true)}>Eliminar</button></div></td>
      </tr>)}</tbody></table></div>
      {!loading && !orders.length && <p>No hay pedidos con estos filtros.</p>}
      <div className="pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1}</span><button disabled={orders.length < 30} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </> : order ? <>
      <AdminOrderDetail order={order} disabled={busy || Boolean(actionId) || loading} onAction={act} />
      <form className="panel" key={order.status + revision} onSubmit={async e => {
        e.preventDefault(); setBusy(true); const fields = Object.fromEntries(new FormData(e.currentTarget));
        try { const r = await fetch("/api/admin/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, ...fields }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setRevision(n => n + 1); }
        catch (e) { setError(e instanceof Error ? e.message : "No se guardó el cambio."); } finally { setBusy(false); }
      }}><h3>Gestión interna</h3><label>Nuevo estado<select name="status" required defaultValue={commercialStatuses.includes(order.status as typeof commercialStatuses[number]) ? order.status : ""}><option value="" disabled>Selecciona un estado comercial</option>{commercialStatuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Observaciones administrativas (privadas)<textarea name="observation" maxLength={3000} /></label><p>Cambiar el estado no devuelve unidades al inventario automáticamente; revisa el stock al cancelar.</p><button className="button" disabled={busy || Boolean(actionId) || loading}>Guardar gestión</button></form>
      <section className="panel"><h3>Historial del pedido</h3>{order.events.map(event => <p key={event.id}>{date(event.createdAt)} · {event.status}: {event.detail}</p>)}<h3>Historial administrativo privado</h3>{history.map(h => { let entry: { from?: string; to?: string; observation?: string } = {}; try { entry = JSON.parse(h.action.slice("ORDER_ADMIN:".length)); } catch { /* Preserve unknown historical records. */ } return <p key={h.id}>{date(h.createdAt)} · {entry.from} → {entry.to}<br />{entry.observation}</p>; })}</section>
    </> : !loading && <p>Pedido no encontrado.</p>}
  </div>;
}
