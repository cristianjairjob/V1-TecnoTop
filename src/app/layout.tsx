import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { categories, storeSettings } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL("https://tecnotop.com.co"),
  title: {
    default: "TecnoTop · Tecnología que conecta contigo",
    template: "%s | TecnoTop",
  },
  description:
    "Audio, celulares, periféricos, gaming, cómputo y redes. Tecnología para tu día, con pago contraentrega en Colombia.",
  icons: { icon: "/brand/tecnotop-original.png" },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cats, store] = await Promise.all([categories(), storeSettings()]);
  return (
    <html lang="es-CO">
      <body>
        <CartProvider>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <Header categories={cats} />
          <main id="contenido">{children}</main>
          <Footer
            email={store.contactEmail || "cristianjairjob@gmail.com"}
            whatsapp={store.whatsapp || "573045939644"}
          />
        </CartProvider>
      </body>
    </html>
  );
}
