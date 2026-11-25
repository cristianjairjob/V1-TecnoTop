import {NextResponse} from "next/server";
import {requireAdmin} from "@/lib/auth";
import {db} from "@/lib/db";
import {failure} from "@/lib/http";
export async function GET(req:Request) {
 try {
  await requireAdmin();
  const raw=Number(new URL(req.url).searchParams.get("page")||0);
  const page=Number.isInteger(raw)&&raw>=0?Math.min(raw,10000):0;
  const rows=await db.newsletterSubscriber.findMany({take:100,skip:page*100,orderBy:{createdAt:"desc"}});
  const products=await db.product.findMany({where:{id:{in:rows.map(r=>r.productId)}},select:{id:true,name:true}});
  return NextResponse.json(rows.map(r=>({...r,productName:products.find(p=>p.id===r.productId)?.name||r.productId})),{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failure(e);}
}
