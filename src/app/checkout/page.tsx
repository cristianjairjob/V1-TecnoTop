import { CartCheckout } from "@/components/cart-checkout";
import { storeSettings } from "@/lib/catalog";
export const metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};
export default async function Checkout() {
  const store = await storeSettings();
  return (
    <div className="wrap page-section">
      <div className="page-heading">
        <span className="eyebrow">PAGO CONTRAENTREGA</span>
        <h1>Un paso más para conectar</h1>
      </div>
      <CartCheckout
        checkout
        enabled={
          process.env.CHECKOUT_ENABLED === "true" && store.policiesApproved
        }
      />
    </div>
  );
}
