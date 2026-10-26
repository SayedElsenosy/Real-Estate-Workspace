import {useTranslations} from "next-intl";
"use client";
import {useState} from "react";import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
export function CancelBookingButton({bookingId}:{bookingId:string}){
 const t=useTranslations("ui");
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const router=useRouter();
 async function cancel(){
  setBusy(true);setError("");
  try{
   const response=await fetch(`/api/bookings/${bookingId}/cancel`,{method:"POST",credentials:"same-origin"});
   const result=await response.json();if(!response.ok)throw Error(result.error||t("cancellationError"));
   setOpen(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:t("cancellationError"));}finally{setBusy(false);}
 }
 return <><Button type="button" size="sm" variant="outline" onClick={()=>setOpen(true)}>{t("cancelBooking")}</Button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader>
   <DialogTitle>{t("confirmCancellation")}</DialogTitle>
   <DialogDescription>{t("cancellationWarning")}</DialogDescription>
  </DialogHeader>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  <div className="flex gap-2"><Button disabled={busy} onClick={cancel}>{busy?t("cancelling"):t("confirmCancel")}</Button><Button disabled={busy} variant="outline" onClick={()=>setOpen(false)}>{t("goBack")}</Button></div>
  </DialogContent></Dialog></>;
}
