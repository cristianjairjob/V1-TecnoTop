import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MetaPixel } from "@/components/meta-pixel";
import { metaConfig } from "@/lib/meta-config";
import { categories, storeSettings, settings } from "@/lib/catalog";
import { parseVisibility, visibilityStyles } from "@/lib/storefront-visibility";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL("https://tecnotop.com.co"),
  title: {
    default: "TecnoTop · Tecnología que conecta contigo",
    template: "%s | TecnoTop",
  },
  description:
    "Audio, celulares, periféricos, gaming, cómputo y redes. Tecnología para tu día, con pago contraentrega en Colombia.",
  icons: { icon: "/brand/tecnotop-logo-v2.png" },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cats, store, visibility] = await Promise.all([categories(), storeSettings(), settings("visibility")]);
  return (
    <html lang="es-CO">
      <body>
        <style>{visibilityStyles(parseVisibility(visibility))}</style>
        <CartProvider>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <Header categories={cats} />
          <MetaPixel pixelId={metaConfig().pixelId} />
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
