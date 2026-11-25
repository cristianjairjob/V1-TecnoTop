import Link from "next/link";
import {currentAdmin} from "@/lib/auth";
import {redirect} from "next/navigation";
export const metadata={title:"Correos registrados",robots:{index:false,follow:false}};
import {AdminSubscribers} from "@/components/admin-subscribers";
export default async function SubscribersPage(){if(!(await currentAdmin()))redirect("/admin/login");return <div className="wrap page-section"><Link href="/admin">← Administración</Link><h1>Correos registrados</h1><AdminSubscribers/></div>;}
