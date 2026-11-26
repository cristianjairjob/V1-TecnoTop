import { storeSettings } from "@/lib/catalog";
export const metadata = { title: "Políticas" };
export default async function Policies() {
  const s = await storeSettings();
  return (
    <div className="wrap page-section legal">
      <div className="page-heading">
        <span className="eyebrow">INFORMACIÓN CLARA</span>
        <h1>Políticas de TecnoTop</h1>
      </div>
      {!s.policiesApproved && (
        <div className="notice">
          La tienda está en preparación. Las condiciones comerciales y de
          tratamiento de datos están pendientes de revisión por el titular; las
          compras permanecen deshabilitadas.
        </div>
      )}
      {[
        { id: "envios", title: "Envíos y pago", body: s.shipping },
        {
          id: "devoluciones",
          title: "Cambios, devoluciones y garantías",
          body: s.returns,
        },
        {
          id: "privacidad",
          title: "Privacidad y tratamiento de datos",
          body: s.privacy,
        },
        { id: "terminos", title: "Términos de compra", body: s.terms },
      ].map((p) => (
        <section id={p.id} key={p.id}>
          <h2>{p.title}</h2>
          <p>
            {s.policiesApproved && p.body
              ? p.body
              : "Información pendiente de publicación."}
          </p>
        </section>
      ))}
      <section id="notificaciones-internas"><h2>Notificaciones internas de pedidos</h2><p>Para gestionar tu compra, TecnoTop almacena tus datos de contacto, dirección y productos solicitados y utiliza Telegram como canal privado de notificaciones al titular de la tienda. Solo el personal autorizado puede acceder a estas notificaciones. No se enviarán mensajes automáticos a tu WhatsApp. Puedes solicitar información, actualización o eliminación de tus datos mediante el correo de contacto, sujeto a las obligaciones de conservación aplicables.</p></section>
      {process.env.NEXT_PUBLIC_META_PIXEL_ID && <section id="medicion-publicitaria"><h2>Medición publicitaria con Meta</h2><p>Solo si aceptas en «Preferencias de privacidad», utilizamos el Píxel de Meta y la API de Conversiones para medir visitas, inicios de compra y pedidos recibidos. Compartimos la página visitada, identificadores de eventos y cookies (_fbp y _fbc), dirección IP cuando esté disponible y datos del navegador. En las etapas de compra también podemos compartir nombre, apellido, correo, teléfono, ciudad y departamento transformados con SHA-256, junto con el importe y la moneda del pedido. El hash no convierte estos datos en anónimos: Meta puede utilizarlos para asociar eventos y medir anuncios. Puedes rechazar o retirar esta autorización mediante «Preferencias de privacidad» sin afectar tu compra. La retirada impide nuevos envíos; no elimina automáticamente los eventos ya enviados.</p></section>}
      <h2>Contacto</h2>
      <p>
        {s.legalName}
        {s.taxId ? ` · NIT ${s.taxId}` : ""}
      </p>
      <a href={`mailto:${s.contactEmail || "cristianjairjob@gmail.com"}`}>
        {s.contactEmail || "cristianjairjob@gmail.com"}
      </a>
    </div>
  );
}
