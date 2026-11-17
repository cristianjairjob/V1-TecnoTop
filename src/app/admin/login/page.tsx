import { AdminLogin } from "@/components/admin";
export const metadata = {
  title: "Acceso administrador",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <div className="wrap page-section">
      <AdminLogin />
    </div>
  );
}
