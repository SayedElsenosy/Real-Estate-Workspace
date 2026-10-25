import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({className,...props}:React.ComponentProps<"input">){return <input className={cn("flex h-11 w-full rounded-xl border border-[#dce6e4] bg-white px-3.5 py-2 text-sm text-[#153b38] outline-none placeholder:text-[#9cadaa] focus:border-[#55a39a] focus:ring-2 focus:ring-[#e1f2ef] disabled:opacity-60",className)} {...props}/>;}
