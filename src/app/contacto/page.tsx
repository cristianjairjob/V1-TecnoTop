import { Mail, MessageCircle, ArrowUpRight } from "lucide-react";
import { storeSettings } from "@/lib/catalog";
export const metadata = { title: "Contacto" };
export default async function Contact() {
  const s = await storeSettings();
  return (
    <div className="wrap page-section">
      <div className="page-heading">
        <span className="eyebrow">CONECTEMOS</span>
        <h1>Estamos para ayudarte.</h1>
        <p>¿Tienes una pregunta sobre un producto o tu pedido? Hablemos.</p>
      </div>
      <div className="contact-grid">
        <a
          className="contact-card"
          href={`https://wa.me/${s.whatsapp || "573045939644"}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={34} />
          <h2>Escríbenos por WhatsApp</h2>
          <p>+{s.whatsapp || "573045939644"}</p>
          <span>
            Iniciar conversación <ArrowUpRight size={18} />
          </span>
        </a>
        <a
          className="contact-card"
          href={`mailto:${s.contactEmail || "cristianjairjob@gmail.com"}`}
        >
          <Mail size={34} />
          <h2>Hablemos por correo</h2>
          <p>{s.contactEmail || "cristianjairjob@gmail.com"}</p>
          <span>
            Enviar un correo <ArrowUpRight size={18} />
          </span>
        </a>
      </div>
      <p className="muted">
        Para consultas sobre una compra, incluye tu número de pedido TecnoTop.
      </p>
    </div>
  );
}
