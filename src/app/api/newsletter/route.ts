import {NextResponse} from "next/server";
import {db} from "@/lib/db";
import {rateLimit,hash} from "@/lib/auth";
import {sameOrigin,readBody,failure,AppError} from "@/lib/http";
import {productPageContent,subscriptionSchema} from "@/lib/product-page-content";
export async function POST(req:Request) {
 try {
  sameOrigin(req);
  await rateLimit("newsletter-global",100,60);
  const input=subscriptionSchema.parse(await readBody(req));
  await rateLimit("newsletter:"+hash(input.email),3,3600);
  const product=await db.product.findFirst({where:{id:input.productId,status:"PUBLISHED",category:{visible:true}},select:{pageContent:true}});
  if(!product)throw new AppError(404,"Producto no disponible.");
  const content=productPageContent(product.pageContent);
  if(!content.footer.visible||!content.footer.newsletterVisible||!content.footer.consentText.trim())throw new AppError(400,"El registro de correos no está disponible.");
  await db.newsletterSubscriber.upsert({where:{email:input.email},create:{email:input.email,productId:input.productId,consentText:content.footer.consentText,privacyVersion:"newsletter-v1"},update:{}});
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failure(e);}
}
