"use client";
import {useEffect,useRef,useState} from "react";
import {Flame} from "lucide-react";
export function StockAlert({stock}:{stock:number}) {
 const ref=useRef<HTMLDivElement>(null);const [floating,setFloating]=useState(false);
 const visible=stock>0 && stock<=10;
 useEffect(()=>{const element=ref.current;if(!element||!visible)return;let observer:IntersectionObserver;
 const observe=()=>{observer?.disconnect();const height=document.querySelector(".site-header")?.getBoundingClientRect().height??0;observer=new IntersectionObserver(([entry])=>setFloating(!entry.isIntersecting&&entry.boundingClientRect.bottom<=height),{rootMargin:"-"+height+"px 0px 0px 0px"});observer.observe(element);};observe();window.addEventListener("resize",observe);return()=>{observer.disconnect();window.removeEventListener("resize",observe);};},[visible]);
 if(!visible)return null;
 const text="¡Últimas "+stock+(stock===1?" unidad!":" unidades!");
 return <><div ref={ref} className="stock-notice"><Flame size={23} aria-hidden="true"/><strong>{text}</strong></div>{floating&&<div className="stock-notice-floating"><Flame size={20} aria-hidden="true"/><strong>{text}</strong></div>}</>;
}
