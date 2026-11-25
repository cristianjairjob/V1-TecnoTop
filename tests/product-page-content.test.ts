import {test,afterEach,mock} from "node:test";
import assert from "node:assert/strict";
import {defaultPageContent,pageContentSchema,productPageContent,safeLink,subscriptionSchema} from "../src/lib/product-page-content";
import {POST} from "../src/app/api/newsletter/route";
import {db} from "../src/lib/db";
const env=process.env.APP_URL;
const restores:(()=>void)[]=[];
function stub(target:object,key:string,fn:unknown){const t=target as Record<string,unknown>;const old=t[key];t[key]=fn;restores.push(()=>{t[key]=old;});}
afterEach(()=>{restores.splice(0).reverse().forEach(f=>f());mock.restoreAll();if(env===undefined)delete process.env.APP_URL;else process.env.APP_URL=env;});
test("per-product sections preserve independent copy, ordering and hidden sections",()=>{
 const a=productPageContent(null),b=productPageContent(null);
 a.technical.title="Contenido propio";a.footer.visible=false;a.order.reverse();
 assert.equal(pageContentSchema.safeParse(a).success,true);
 assert.equal(b.technical.title,defaultPageContent.technical.title);
 assert.equal(b.footer.visible,true);
 assert.equal(pageContentSchema.safeParse({...a,order:["technical","technical","purchase","footer"]}).success,false);
 assert.equal(pageContentSchema.safeParse({...a,technical:{...a.technical,specs:Array(21).fill({label:"x",value:"y"})}}).success,false);
});
test("unsafe links, images, styles and excessive copy are rejected",()=>{
 for(const link of ["javascript:alert(1)","data:text/html,x","//evil.test","/\\evil","/\n/evil","http://insecure.test"])assert.equal(safeLink.safeParse(link).success,false,link);
 for(const link of ["/politicas#privacidad","https://example.com/ayuda",""])assert.equal(safeLink.safeParse(link).success,true,link);
 const c=productPageContent(null);
 assert.equal(pageContentSchema.safeParse({...c,theme:{...c.theme,accent:"red;display:none"}}).success,false);
 assert.equal(pageContentSchema.safeParse({...c,technical:{...c.technical,image:"javascript:alert(1)"}}).success,false);
 assert.equal(pageContentSchema.safeParse({...c,purchase:{...c.purchase,faqs:[{question:"Q",answer:"x".repeat(2501)}]}}).success,false);
});
test("subscription requires explicit consent and a valid email",()=>{
 for(const consent of [false,undefined,"true"])assert.equal(subscriptionSchema.safeParse({email:"a@example.com",productId:"p",consent}).success,false);
 assert.equal(subscriptionSchema.safeParse({email:"bad",productId:"p",consent:true}).success,false);
});
function request(body:unknown,origin="https://tecnotop.com.co"){process.env.APP_URL="https://tecnotop.com.co";return new Request("https://tecnotop.com.co/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json",origin},body:JSON.stringify(body)});}
function setup(visible=true){
 stub(db.rateLimit,"upsert",async()=>({count:1}));
 const c=productPageContent(null);c.footer.newsletterVisible=visible;c.footer.consentText="Autorización específica del producto";
 stub(db.product,"findFirst",async()=>({pageContent:c}));
 return c;
}
test("newsletter stores server-side consent and deduplicates without sending messages",async()=>{
 setup();let writes=0;const emails=new Set<string>();
 stub(db.newsletterSubscriber,"upsert",async(args:{where:{email:string};create:{consentText:string;productId:string};update:object})=>{
  assert.equal(args.create.consentText,"Autorización específica del producto");assert.equal(args.create.productId,"p");assert.deepEqual(args.update,{});emails.add(args.where.email);writes++;return {};
 });
 mock.method(globalThis,"fetch",async()=>assert.fail("No sends"));
 const body={email:"Ana@Example.com",productId:"p",consent:true};
 assert.equal((await POST(request(body))).status,200);
 assert.equal((await POST(request(body))).status,200);
 assert.equal(writes,2);assert.deepEqual([...emails],["ana@example.com"]);
});
test("newsletter rejects missing consent, foreign origin and hidden forms before saving",async()=>{
 setup(false);stub(db.newsletterSubscriber,"upsert",async()=>assert.fail("Must not save"));
 assert.equal((await POST(request({productId:"p",email:"a@example.com",consent:false}))).status,400);
 assert.equal((await POST(request({productId:"p",email:"a@example.com",consent:true},"https://other.test"))).status,403);
 assert.equal((await POST(request({productId:"p",email:"a@example.com",consent:true}))).status,400);
});
