import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants=cva("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:pointer-events-none disabled:opacity-45 cursor-pointer",{
  variants:{variant:{default:"bg-[#19776f] text-white hover:bg-[#11625c] shadow-[0_4px_12px_rgba(25,119,111,.15)]",outline:"border border-[#dce5e4] bg-white text-[#163c3a] hover:bg-[#f1f7f6]",ghost:"text-[#526765] hover:bg-[#eaf1f0]",secondary:"bg-[#e9f3f0] text-[#12665e] hover:bg-[#d9e9e5]",destructive:"bg-red-600 text-white hover:bg-red-700"},
  size:{default:"h-10 px-4 py-2",sm:"h-9 px-3",lg:"h-12 px-6",icon:"size-10"}},defaultVariants:{variant:"default",size:"default"}
});
export type ButtonProps=React.ComponentProps<"button">&VariantProps<typeof variants>&{asChild?:boolean};
export function Button({className,variant,size,asChild=false,...props}:ButtonProps) {
 const Comp=asChild?Slot:"button";
 return <Comp data-slot="button" className={cn(variants({variant,size}),className)} {...props}/>;
}
