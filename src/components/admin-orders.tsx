"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/catalog-format";
import { formatDeliveryDate } from "@/lib/delivery";
import { commercialStatuses } from "@/lib/order-management";
import { whatsappUrl } from "@/lib/whatsapp";
type Order = { id: string; number: string; createdAt: string; status: string; customer: { name: string; phone: string; email: string }; address: { state: string; city: string; address: string; complement?: string; buyer?: { firstName: string; lastName: string }; delivery?: { additionalNotes?: string; requestedDate?: string; establishment?: string; reference?: string } }; items: { id: string; name: string; quantity: number; unitPrice: string; snapshot: { variant?: string; colors?: string[]; offer?: string } }[]; subtotal: string; discount: string; shipping: string; total: string; pricingSnapshot?: { isTest?: boolean; baseSubtotal: number; savings: number }; promotionCode: string | null; paymentMethod: string; events: { id: string; status: string; detail: string; createdAt: string }[] };
type Audit = { id: string; action: string; createdAt: string };
const date = (s: string) => new Date(s).toLocaleString("es-CO", { timeZone: "America/Bogota" });
export function AdminOrders({ orderId }: { orderId?: string }) {
  const [orders, setOrders] = useState<Order[]>([]), [history, setHistory] = useState<Audit[]>([]);
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [sort, setSort] = useState("desc"), [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
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
      <div className="table-wrap"><table><thead><tr>{["Pedido / fecha", "Cliente / teléfono", "Ciudad", "Productos / cantidades", "Total", "Pago", "Estado"].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{orders.map(o => <tr key={o.id}>
        <td><Link href={`/admin/pedidos/${o.id}`}>{o.number}</Link>{o.pricingSnapshot?.isTest && <strong> · PRUEBA</strong>}<br />{date(o.createdAt)}</td><td>{o.customer.name}<br />{o.customer.phone}</td><td>{o.address.city}</td><td>{o.items.map(i => <div key={i.id}>{i.quantity} × {i.name}</div>)}</td><td>{money(Number(o.total))}</td><td>{o.paymentMethod}</td><td>{o.status}</td>
      </tr>)}</tbody></table></div>
      {!loading && !orders.length && <p>No hay pedidos con estos filtros.</p>}
      <div className="pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1}</span><button disabled={orders.length < 30} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </> : order ? <>
      <section className="panel"><h2>{order.number}</h2>{order.pricingSnapshot?.isTest && <p role="status"><strong>PRUEBA · Producto de demostración. No despachar.</strong></p>}<p>{date(order.createdAt)} · {order.status} · {order.paymentMethod}</p>
        <h3>Comprador</h3><p>{order.address.buyer ? `${order.address.buyer.firstName} ${order.address.buyer.lastName}` : order.customer.name}<br />{order.customer.phone}<br />{order.customer.email || "Sin correo"}</p>
        <button onClick={async () => { try { await navigator.clipboard.writeText(order.customer.phone); setError("Teléfono copiado."); } catch { setError("Selecciona el teléfono para copiarlo."); } }}>Copiar teléfono</button>{whatsappUrl(order.customer.phone) && <a className="button" href={whatsappUrl(order.customer.phone)!} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
        <h3>Entrega</h3><p>{order.address.state} · {order.address.city}<br />{order.address.address}<br />{order.address.complement}</p>
        <p>Notas: {order.address.delivery?.additionalNotes || "SIN NOTAS"}</p><p>{order.address.delivery?.establishment} {order.address.delivery?.reference}</p><p>Fecha solicitada: {order.address.delivery?.requestedDate ? formatDeliveryDate(order.address.delivery.requestedDate) : "NO ESPECIFICADA"}. Sujeta a confirmación.</p>
        <h3>Productos y promociones</h3>{order.items.map(i => <div key={i.id}><strong>{i.quantity} × {i.name}</strong><p>Variante: {i.snapshot?.variant || "Única"} · Colores: {i.snapshot?.colors?.join(", ") || "No aplica"}<br />{i.snapshot?.offer || "Sin promoción registrada"} · {money(Number(i.unitPrice))} por unidad · {money(Number(i.unitPrice) * i.quantity)}</p></div>)}
        <p>Cupón: {order.promotionCode || "No aplica"}<br />Subtotal antes de descuentos: {money(Number(order.pricingSnapshot?.baseSubtotal ?? order.subtotal))}<br />Descuentos: {money(Number(order.pricingSnapshot?.savings ?? order.discount))}<br />Envío: {Number(order.shipping) === 0 ? "GRATIS" : money(Number(order.shipping))}</p><h3>Total contraentrega: {money(Number(order.total))}</h3>
      </section>
      <form className="panel" key={order.status + revision} onSubmit={async e => {
        e.preventDefault(); setBusy(true); const fields = Object.fromEntries(new FormData(e.currentTarget));
        try { const r = await fetch("/api/admin/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, ...fields }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setRevision(n => n + 1); }
        catch (e) { setError(e instanceof Error ? e.message : "No se guardó el cambio."); } finally { setBusy(false); }
      }}><h3>Gestión interna</h3><label>Nuevo estado<select name="status" required defaultValue={commercialStatuses.includes(order.status as typeof commercialStatuses[number]) ? order.status : ""}><option value="" disabled>Selecciona un estado comercial</option>{commercialStatuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Observaciones administrativas (privadas)<textarea name="observation" maxLength={3000} /></label><p>Cambiar el estado no devuelve unidades al inventario automáticamente; revisa el stock al cancelar.</p><button className="button" disabled={busy}>Guardar gestión</button></form>
      <section className="panel"><h3>Historial del pedido</h3>{order.events.map(event => <p key={event.id}>{date(event.createdAt)} · {event.status}: {event.detail}</p>)}<h3>Historial administrativo privado</h3>{history.map(h => { let entry: { from?: string; to?: string; observation?: string } = {}; try { entry = JSON.parse(h.action.slice("ORDER_ADMIN:".length)); } catch { /* Preserve unknown historical records. */ } return <p key={h.id}>{date(h.createdAt)} · {entry.from} → {entry.to}<br />{entry.observation}</p>; })}</section>
    </> : !loading && <p>Pedido no encontrado.</p>}
  </div>;
}
