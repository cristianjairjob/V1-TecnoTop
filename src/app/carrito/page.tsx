import { CartCheckout } from "@/components/cart-checkout";
export const metadata = { title: "Tu carrito" };
export default function Cart() {
  return (
    <div className="wrap page-section">
      <div className="page-heading">
        <span className="eyebrow">CASI TUYO</span>
        <h1>Tu carrito</h1>
        <p>Revisa tu selección antes de continuar.</p>
      </div>
      <CartCheckout />
    </div>
  );
}
