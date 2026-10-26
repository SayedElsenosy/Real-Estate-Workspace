import {getRequestConfig} from "next-intl/server";
import {cookies} from "next/headers";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
export default getRequestConfig(async()=>{
 const locale=(await cookies()).get("bunyra-locale")?.value==="en"?"en":"ar";
 return {locale,messages:locale==="en"?en:ar,timeZone:"Africa/Cairo"};
});
