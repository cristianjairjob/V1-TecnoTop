"use client";
import Link from "next/link";
import {useState} from "react";
export function ProductNewsletter({productId,button,consent}:{productId:string;button:string;consent:string}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 return <form className="product-newsletter" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);setBusy(true);setMessage("");setError(false);try{const r=await fetch("/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId,email:data.get("email"),consent:data.get("consent")==="on"})});const result=await r.json();if(!r.ok)throw Error(result.error||"No se pudo registrar el correo.");setMessage("Gracias. Tu correo quedó registrado.");form.reset();}catch(e){setError(true);setMessage(e instanceof Error?e.message:"Intenta nuevamente.");}finally{setBusy(false);}}}>
 <div className="newsletter-entry"><input type="email" name="email" required maxLength={254} aria-label="Correo para recibir ofertas" placeholder="tu@correo.com" autoComplete="email"/><button disabled={busy||!consent.trim()}>{busy?"Guardando…":button||"Suscribirme"}</button></div>
 <label className="newsletter-consent"><input type="checkbox" required name="consent"/><span>{consent} <Link href="/politicas#privacidad">Ver política de privacidad</Link>.</span></label>
 {message&&<p role={error?"alert":"status"}>{message}</p>}
 </form>;
}
