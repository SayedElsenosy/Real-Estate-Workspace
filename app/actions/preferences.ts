"use server";
import { cookies } from "next/headers";
export async function setPreferredLocale(locale:"ar"|"en"){
 if(!["ar","en"].includes(locale))throw new Error("Unsupported locale");
 (await cookies()).set("bunyra-locale",locale,{
  httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",
  path:"/",maxAge:60*60*24*365
 });
}
