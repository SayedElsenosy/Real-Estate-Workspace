import "server-only";
import { cookies } from "next/headers";
import { createTranslator } from "next-intl";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
export type WorkspaceLocale="ar"|"en";
export async function getServerI18n(){
 const locale=(await cookies()).get("bunyra-locale")?.value==="en"?"en":"ar";
 const messages=locale==="ar"?ar:en;
 return {locale,messages,t:createTranslator({locale,messages})};
}
