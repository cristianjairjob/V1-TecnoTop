import { Confirmation } from "@/components/confirmation";
export const metadata = {
  title: "Confirmación",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <div className="wrap page-section">
      <Confirmation />
    </div>
  );
}
