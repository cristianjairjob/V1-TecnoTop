import type {CSSProperties} from "react";
import {Check, X, Smartphone, MessageCircle, House, Banknote, Truck, ShieldCheck, Plus} from "lucide-react";
import {ProductPageContent} from "@/lib/product-page-content";
import {ProductNewsletter} from "./product-newsletter";
const icons={phone:Smartphone,message:MessageCircle,home:House,payment:Banknote,truck:Truck,shield:ShieldCheck};
function CompareValue({value}:{value:string}) {
 const normalized=value.trim().toLowerCase();
 if(["sí","si","yes","✓"].includes(normalized))return <span aria-label="Sí" className="compare-yes"><Check aria-hidden="true"/></span>;
 if(["no","×","✗"].includes(normalized))return <span aria-label="No" className="compare-no"><X aria-hidden="true"/></span>;
 return <span>{value||"—"}</span>;
}
export function ProductPageSections({content:c,productId,name,image,email,whatsapp}:{content:ProductPageContent;productId:string;name:string;image:string;email:string;whatsapp:string}) {
 const t=c.technical,compare=c.comparison,p=c.purchase,f=c.footer;
 const contactEmail=f.email||email,contactWhatsapp=f.whatsapp||whatsapp;
 return <div className="product-story" style={{"--story-bg":c.theme.background,"--story-accent":c.theme.accent,"--story-text":c.theme.text} as CSSProperties}>
 {c.order.map(section=>{
 if(!c[section].visible)return null;
 if(section==="technical")return <section className={"story-section story-technical image-"+t.imageSide} key={section}>
 {(t.image||image)&&<figure><img src={t.image||image} alt={t.imageAlt||name} loading="lazy"/></figure>}
 <div><p className="story-eyebrow">{t.eyebrow}</p><h2>{t.title}</h2>{t.includes.some(s=>s.trim())&&<div className="story-includes"><h3>{t.includesTitle}</h3><ul>{t.includes.filter(s=>s.trim()).map((item,i)=><li key={i}><Check aria-hidden="true"/><span>{item}</span></li>)}</ul></div>}
 {t.specs.length>0&&<dl className="story-specs">{t.specs.map((spec,i)=><div key={i}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}</div></section>;
 if(section==="comparison")return <section className="story-section story-comparison" key={section}><p className="story-eyebrow">{compare.eyebrow}</p><h2>{compare.title}</h2>{compare.description&&<p className="story-intro">{compare.description}</p>}
 <div className="story-table-wrap"><table><caption className="sr-only">{compare.title}</caption><thead><tr><th scope="col">Característica</th><th scope="col" className="ours">{compare.ours||name}</th><th scope="col">{compare.other}</th></tr></thead><tbody>{compare.rows.map((row,i)=><tr key={i}><th scope="row">{row.label}</th><td className="ours"><CompareValue value={row.ours}/></td><td><CompareValue value={row.other}/></td></tr>)}</tbody></table></div></section>;
 if(section==="purchase")return <section className="story-section story-purchase" key={section}><div><p className="story-eyebrow">{p.eyebrow}</p><h2>{p.title}</h2><ol className="story-steps">{p.steps.map((step,i)=>{const Icon=icons[step.icon];return <li key={i}><span className="story-step-icon"><Icon aria-hidden="true"/></span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>;})}</ol></div><div><p className="story-eyebrow">{p.faqEyebrow}</p><h2>{p.faqTitle}</h2><div className="story-faqs">{p.faqs.map((faq,i)=><details key={i}><summary>{faq.question}<Plus size={20} aria-hidden="true"/></summary><p>{faq.answer}</p></details>)}</div></div></section>;
 return <footer className="story-section product-custom-footer" key={section}><div>{f.logo&&<img className="story-footer-logo" src={f.logo} alt={f.brand} loading="lazy"/>}<h2>{f.brand}</h2><p>{f.description}</p></div><div><h3>{f.contactTitle}</h3>{contactWhatsapp&&<a href={"https://wa.me/"+contactWhatsapp} target="_blank" rel="noopener noreferrer">WhatsApp {contactWhatsapp}</a>}{contactEmail&&<a href={"mailto:"+contactEmail}>{contactEmail}</a>}{f.hours&&<p>{f.hours}</p>}</div><div><h3>{f.helpTitle}</h3>{f.links.filter(link=>link.href&&link.label).map((link,i)=><a key={i} href={link.href}>{link.label}</a>)}</div>{f.newsletterVisible&&<div><h3>{f.newsletterTitle}</h3><p>{f.newsletterDescription}</p><ProductNewsletter productId={productId} button={f.newsletterButton} consent={f.consentText}/></div>}</footer>;
 })}
 </div>;
}
