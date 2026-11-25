import Link from "next/link";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
export function Footer({
  email,
  whatsapp,
}: {
  email: string;
  whatsapp: string;
}) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <Link href="/" className="footer-brand">
            Tecno<span>Top</span>
            <ArrowUpRight />
          </Link>
          <p>
            Tecnología que conecta contigo.
            <br />
            Encuentra tu próxima conexión.
          </p>
          <span className="country">CO · Colombia</span>
        </div>
        <div>
          <h3>Explora</h3>
          <Link href="/catalogo">Todo el catálogo</Link>
          <Link href="/audio">Audio</Link>
          <Link href="/gaming">Gaming</Link>
          <Link href="/computo">Cómputo</Link>
        </div>
        <div>
          <h3>Estamos para ayudarte</h3>
          <Link href="/seguimiento">Sigue tu pedido</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/politicas">Envíos y devoluciones</Link>
          <Link href="/politicas#privacidad">Privacidad y datos</Link>
        </div>
        <div>
          <h3>Hablemos</h3>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`}>
              <Mail size={17} />
              {email}
            </a>
          )}
          <p>
            Pago contraentrega.
            <br />
            Envío gratis para ti.
          </p>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} TecnoTop.</span>
        <span>Hecho para conectar.</span>
        <Link href="/admin">Administración</Link>
      </div>
    </footer>
  );
}
