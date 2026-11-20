import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { AdminOrders } from "@/components/admin-orders";
export const metadata = { title: "Administración TecnoTop", robots: { index:false, follow:false } };
export default async function Page() { if (!(await currentAdmin())) redirect("/admin/login"); return <AdminOrders />; }
