import {getServerI18n} from "@/lib/i18n/server";
import Link from "next/link";

type Query = Record<string, string | undefined>;
export async function PaginationNav({path,page,limit,total,search,params={}}:{
  path:string;page:number;limit:number;total:number;search:string;params?:Query;
}) {
  const {t}=await getServerI18n();
  const last=Math.max(1,Math.ceil(total/limit));
  const url=(next:number)=>{
    const q=new URLSearchParams();
    for(const [key,value] of Object.entries(params)) if(value) q.set(key,value);
    if(search) q.set("search",search);
    if(limit!==20) q.set("limit",String(limit));
    if(next>1) q.set("page",String(next));
    const qs=q.toString();return path+(qs?"?"+qs:"");
  };
  const linkClass="rounded-lg border border-[#dce6e4] bg-white px-4 py-2 text-sm font-semibold text-[#176f65] hover:bg-[#eef7f3]";
  const disabledClass="rounded-lg border border-[#e4ece9] px-4 py-2 text-sm text-[#a0b0ab]";
  return <nav aria-label="تقسيم الصفحات" className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <span className="text-sm text-[#6c827b]">عرض {total===0?0:(page-1)*limit+1}–{Math.min(page*limit,total)} من {total} · صفحة {page} من {last}</span>
    <div className="flex items-center gap-2">
      {page>1?<Link className={linkClass} href={url(page-1)}>{t("common.previous")}</Link>:<span className={disabledClass}>{t("common.previous")}</span>}
      {page<last?<Link className={linkClass} href={url(page+1)}>{t("common.next")}</Link>:<span className={disabledClass}>{t("common.next")}</span>}
    </div>
  </nav>;
}
export async function TableSearch({path,search,placeholder="ابحث",params={}}:{
  path:string;search:string;placeholder?:string;params?:Query;
}) {
  const {t}=await getServerI18n();
  return <form method="get" action={path} role="search" className="flex flex-wrap gap-2">
    {Object.entries(params).filter(([,v])=>!!v).map(([key,v])=><input key={key} type="hidden" name={key} value={v}/>)}
    <input type="search" name="search" aria-label="البحث في قاعدة البيانات" defaultValue={search}
      placeholder={placeholder} maxLength={120} className="h-10 min-w-44 rounded-xl border border-[#dce6e4] bg-white px-3 text-sm"/>
    <button type="submit" className="rounded-xl bg-[#19776f] px-4 py-2 text-sm font-bold text-white">{t("common.search")}</button>
  </form>;
}
