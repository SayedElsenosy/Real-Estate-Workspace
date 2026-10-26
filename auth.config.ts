import type { NextAuthConfig } from "next-auth";
/** Edge-safe cookie verification for middleware: no PostgreSQL or bcrypt imports. */
export default {
 providers: [],
 pages: { signIn: "/login" },
 session: { strategy: "jwt", maxAge: 4 * 60 * 60 },
 callbacks: {
  authorized({auth}) { return Boolean(auth?.user); },
 },
} satisfies NextAuthConfig;
