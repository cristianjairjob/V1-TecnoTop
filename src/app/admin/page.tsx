import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { Admin } from "@/components/admin";
export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentAdmin())) redirect("/admin/login");
  return <Admin />;
}
