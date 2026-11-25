import { z } from "zod";
const short = z.string().max(200);
const text = z.string().max(2500);
export const safeLink = z.string().max(1000).refine(s => s === "" || (/^\/(?!\/)[^\s\\]*$/.test(s)) || (z.url().safeParse(s).success && s.startsWith("https://")), "Usa una ruta interna o un enlace HTTPS.");
const image = z.union([z.literal(""), z.url().refine(s=>s.startsWith("https://"))]);
const heading = { visible: z.boolean(), eyebrow: short, title: short };
export const sectionKeys = ["technical", "comparison", "purchase", "footer"] as const;
export const pageContentSchema = z.object({
  order: z.array(z.enum(sectionKeys)).length(4).refine(a=>new Set(a).size===4),
  theme: z.object({ background: z.string().regex(/^#[0-9a-fA-F]{6}$/), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), text: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  technical: z.object({ ...heading, image, imageAlt: short, imageSide: z.enum(["left","right"]), includesTitle: short, includes: z.array(short).max(20), specs: z.array(z.object({label:short,value:short})).max(20) }),
  comparison: z.object({ ...heading, description:text, ours:short, other:short, rows:z.array(z.object({label:short,ours:short,other:short})).max(20) }),
  purchase: z.object({ ...heading, steps:z.array(z.object({title:short,description:text,icon:z.enum(["phone","message","home","payment","truck","shield"])})).max(12), faqEyebrow:short, faqTitle:short, faqs:z.array(z.object({question:short,answer:text})).max(20) }),
  footer:z.object({visible:z.boolean(),brand:short,description:text,logo:image,contactTitle:short,email:z.union([z.literal(""),z.email()]),whatsapp:z.string().regex(/^\d{0,15}$/),hours:short,helpTitle:short,links:z.array(z.object({label:short,href:safeLink})).max(15),newsletterVisible:z.boolean(),newsletterTitle:short,newsletterDescription:text,newsletterButton:short,consentText:short})
});
export type ProductPageContent = z.infer<typeof pageContentSchema>;
export const defaultPageContent:ProductPageContent = {
 order:["technical","comparison","purchase","footer"],
 theme:{background:"#082541",accent:"#42c7ff",text:"#f1f8ff"},
 technical:{visible:true,eyebrow:"FICHA DEL PRODUCTO",title:"Todo sobre tu próxima compra.",image:"",imageAlt:"",imageSide:"left",includesTitle:"Información de tu pedido",includes:["Elige tu producto, cantidad y colores disponibles.","Revisa tu selección antes de confirmar."],specs:[{label:"Forma de pago",value:"Contraentrega"},{label:"Envío al comprador",value:"Gratis"}]},
 comparison:{visible:true,eyebrow:"COMPARA",title:"Elige con toda la información.",description:"Revisa las condiciones de cada tienda antes de comprar.",ours:"TecnoTop",other:"Otras tiendas",rows:[{label:"Envío al comprador",ours:"Gratis",other:"Consultar"},{label:"Forma de pago",ours:"Contraentrega",other:"Consultar"},{label:"Atención",ours:"WhatsApp",other:"Consultar"}]},
 purchase:{visible:true,eyebrow:"ASÍ DE FÁCIL",title:"Lo pides hoy. Pagas al recibir.",steps:[{title:"Elige tu producto",description:"Selecciona la cantidad y el color de cada unidad.",icon:"phone"},{title:"Completa tus datos",description:"Indica tu nombre, celular y dirección de entrega.",icon:"message"},{title:"Revisamos tu pedido",description:"Te contactaremos si necesitamos confirmar información.",icon:"truck"},{title:"Paga al recibir",description:"Tu pedido se gestiona con pago contraentrega.",icon:"payment"}],faqEyebrow:"PREGUNTAS FRECUENTES",faqTitle:"Resolvemos tus dudas.",faqs:[{question:"¿Cómo pago mi pedido?",answer:"El pago es contraentrega: pagas al recibir."},{question:"¿El envío tiene costo?",answer:"El envío es gratuito para el comprador."},{question:"¿La fecha solicitada está confirmada?",answer:"La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora."},{question:"¿Cómo consulto las condiciones de garantía?",answer:"Consulta nuestras políticas de garantías, cambios y devoluciones o comunícate con TecnoTop por WhatsApp."}]},
 footer:{visible:true,brand:"TecnoTop",description:"Tecnología que conecta contigo. Compra con envío gratis y pago contraentrega.",logo:"",contactTitle:"CONTÁCTANOS",email:"",whatsapp:"",hours:"",helpTitle:"TE AYUDAMOS",links:[{label:"Contacto",href:"/contacto"},{label:"Envíos, cambios y garantías",href:"/politicas"},{label:"Privacidad y datos",href:"/politicas#privacidad"},{label:"Condiciones de compra",href:"/politicas#terminos"}],newsletterVisible:true,newsletterTitle:"OFERTAS ANTES QUE NADIE",newsletterDescription:"Registra tu correo para recibir novedades y ofertas de TecnoTop.",newsletterButton:"Quiero recibir ofertas",consentText:"Autorizo recibir novedades y ofertas de TecnoTop por correo y acepto la política de privacidad."}
};
export function productPageContent(value:unknown):ProductPageContent {
 const parsed=pageContentSchema.safeParse(value);
 return parsed.success?parsed.data:structuredClone(defaultPageContent);
}
export const subscriptionSchema=z.object({productId:z.string().min(1).max(100),email:z.email().max(254).transform(s=>s.toLowerCase()),consent:z.literal(true)});
