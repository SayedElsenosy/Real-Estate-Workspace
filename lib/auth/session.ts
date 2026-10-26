import "server-only";
import { auth } from "@/auth";
/** Identity comes exclusively from Auth.js. No bearer, role header or body fallback. */
export async function getDatabaseSession() {
 const session=await auth();
 return session?.user ?? null;
}
export async function verifyRequestIdentity(request:Request) {
 // Cookie-authenticated mutations must not accept cross-site browser requests.
 if (!["GET","HEAD","OPTIONS"].includes(request.method)) {
  const origin=request.headers.get("origin");
  const expected=new URL(process.env.AUTH_URL ?? request.url).origin;
  if ((origin && origin!==expected) || request.headers.get("sec-fetch-site")==="cross-site") return null;
 }
 return getDatabaseSession();
}
