import * as React from "react";
import { cn } from "@/lib/utils";
export function Table({className,...props}:React.ComponentProps<"table">){return <div className="w-full overflow-x-auto"><table className={cn("w-full text-sm text-right",className)} {...props}/></div>;}
export function TableHeader({className,...props}:React.ComponentProps<"thead">){return <thead className={cn("bg-[#f6f9f8] text-[#607774]",className)} {...props}/>;}
export function TableBody({className,...props}:React.ComponentProps<"tbody">){return <tbody className={cn("divide-y divide-[#edf1f0]",className)} {...props}/>;}
export function TableRow({className,...props}:React.ComponentProps<"tr">){return <tr className={cn("border-b border-[#edf1f0] hover:bg-[#fafcfb]",className)} {...props}/>;}
export function TableHead({className,...props}:React.ComponentProps<"th">){return <th className={cn("h-12 px-5 font-semibold",className)} {...props}/>;}
export function TableCell({className,...props}:React.ComponentProps<"td">){return <td className={cn("px-5 py-4 text-[#2b4543]",className)} {...props}/>;}
