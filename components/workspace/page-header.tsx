import { type ReactNode } from "react";
export function PageHeader({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){
 return <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
 <div><p className="mb-2 text-xs font-bold tracking-[.14em] text-[#198278]">{eyebrow}</p><h1 className="text-3xl font-black tracking-tight text-[#183d37]">{title}</h1>{description&&<p className="mt-2 text-sm text-[#78918b]">{description}</p>}</div>
 {action&&<div>{action}</div>}
 </header>;
}
