import * as React from "react";
import { cn } from "@/lib/utils";
export function Card({className,...props}:React.ComponentProps<"div">) {return <div className={cn("rounded-2xl border border-[#e5eae9] bg-white shadow-[0_6px_32px_rgba(16,46,44,.035)]",className)} {...props}/>;}
export function CardHeader({className,...props}:React.ComponentProps<"div">){return <div className={cn("flex flex-col gap-1 p-6",className)} {...props}/>;}
export function CardTitle({className,...props}:React.ComponentProps<"h3">){return <h3 className={cn("text-lg font-bold text-[#183635]",className)} {...props}/>;}
export function CardContent({className,...props}:React.ComponentProps<"div">){return <div className={cn("p-6 pt-0",className)} {...props}/>;}
