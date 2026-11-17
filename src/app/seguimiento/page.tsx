import { Tracking } from "@/components/tracking";
export const metadata = {
  title: "Sigue tu pedido",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <div className="wrap page-section">
      <div className="page-heading">
        <span className="eyebrow">SIEMPRE AL TANTO</span>
        <h1>Tu pedido, paso a paso</h1>
      </div>
      <Tracking />
    </div>
  );
}
