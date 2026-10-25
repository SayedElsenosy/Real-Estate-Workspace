"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog=DialogPrimitive.Root;
export const DialogTrigger=DialogPrimitive.Trigger;
export const DialogClose=DialogPrimitive.Close;
export function DialogContent({children,className,...props}:React.ComponentProps<typeof DialogPrimitive.Content>) {
 return <DialogPrimitive.Portal>
   <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#112b29]/55 backdrop-blur-[2px] data-[state=open]:animate-in"/>
   <DialogPrimitive.Content dir="rtl" className={cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#dce7e5] bg-white p-7 shadow-2xl",className)} {...props}>
     {children}
     <DialogPrimitive.Close aria-label="إغلاق" className="absolute top-4 left-4 rounded-md p-1 text-[#718784] hover:bg-[#e8f0ef]"><X className="size-5"/></DialogPrimitive.Close>
   </DialogPrimitive.Content>
 </DialogPrimitive.Portal>;
}
export function DialogHeader({children,className,...props}:React.ComponentProps<"div">){return <div className={cn("mb-5 space-y-2",className)} {...props}>{children}</div>;}
export function DialogTitle({children,className,...props}:React.ComponentProps<typeof DialogPrimitive.Title>){return <DialogPrimitive.Title className={cn("text-xl font-bold text-[#153c39]",className)} {...props}>{children}</DialogPrimitive.Title>;}
export function DialogDescription({children,className,...props}:React.ComponentProps<typeof DialogPrimitive.Description>){return <DialogPrimitive.Description className={cn("text-sm leading-6 text-[#78908c]",className)} {...props}>{children}</DialogPrimitive.Description>;}
