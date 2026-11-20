import { productColors } from "@/lib/product-colors";
import { CartCheckout } from "@/components/cart-checkout";
import { checkoutReadiness } from "@/lib/checkout-readiness";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { directCheckoutSchema } from "@/lib/direct-checkout";
import type { CartLine } from "@/components/cart-provider";
export const metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};
export default async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const readiness = await checkoutReadiness();
  const query = await searchParams;
  let directItems: CartLine[] | undefined;
  if (query.product !== undefined) {
    const parsed = directCheckoutSchema.safeParse(query);
    if (!parsed.success || !process.env.DATABASE_URL) notFound();
    const selection = parsed.data;
    const p = await db.product.findFirst({ where: { id: selection.product, status: "PUBLISHED", category: { visible: true } }, include: { variants: { where: { active: true } } } });
    if (!p) notFound();
    const variant = p.variants.find((v) => v.id === selection.variant);
    if ((selection.variant && !variant) || (p.variants.length && !variant && !productColors(p.colorOptions).length)) notFound();
    directItems = [{ productId: p.id, variantId: variant?.id, quantity: selection.quantity, name: p.name + (variant ? ` · ${variant.name}` : ""), image: Array.isArray(p.images) ? String(p.images[0] ?? "") : "", price: Number(variant?.salePrice ?? p.salePrice), stock: variant?.stock ?? p.stock }];
  }
  return (
    <div className="wrap page-section">
      <div className="page-heading">
        <span className="eyebrow">PAGO CONTRAENTREGA</span>
        <h1>Un paso más para conectar</h1>
      </div>
      <CartCheckout
        key={directItems ? `${directItems[0].productId}:${directItems[0].variantId}:${directItems[0].quantity}` : "cart"}
        directItems={directItems}
        checkout
        enabled={
          readiness.enabled
        }
      />
    </div>
  );
}
