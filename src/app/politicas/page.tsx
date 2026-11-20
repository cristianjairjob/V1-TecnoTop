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
