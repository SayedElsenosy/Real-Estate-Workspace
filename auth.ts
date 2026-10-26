import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import authConfig from "./auth.config";
import { getAuthDatabase } from "@/lib/db/auth-client";
import { authUsers, accounts, sessions, verificationTokens } from "@/lib/db/auth-schema";
import { authorizeCredentials, currentAuthUser } from "@/lib/auth/credentials";

// Lazy setup: build and unauthenticated pages do not require a database connection.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
 ...authConfig,
 adapter: DrizzleAdapter(getAuthDatabase(), {
  usersTable: authUsers, accountsTable: accounts,
  sessionsTable: sessions, verificationTokensTable: verificationTokens,
 }),
 session: { strategy: "jwt", maxAge: 4 * 60 * 60 },
 providers: [Credentials({
  credentials: { email: {type:"email"}, password: {type:"password"} },
  authorize: authorizeCredentials,
 })],
 callbacks: {
  async jwt({token,user}) {
   if (user) {
    token.sub=user.id; token.tenantId=user.tenantId; token.role=user.role;
    token.externalAuthId=user.externalAuthId; token.companyName=user.companyName;
    token.authVersion=user.authVersion;
   }
   if (!token.sub) return null;
   // Revalidate on EVERY server session read; never accept client session.update claims.
   const row=await currentAuthUser(token.sub);
   if (!row || !row.user.isActive || !row.user.passwordHash || !row.user.externalAuthId ||
    row.user.authVersion!==token.authVersion || row.user.tenantId!==token.tenantId ||
    row.user.role!==token.role || row.user.externalAuthId!==token.externalAuthId) return null;
   token.companyName=row.companyName; token.name=row.user.name; token.email=row.user.email;
   return token;
  },
  session({session,token}) {
   session.user.id=token.sub!;
   session.user.tenantId=token.tenantId;
   session.user.role=token.role;
   session.user.externalAuthId=token.externalAuthId;
   session.user.companyName=token.companyName;
   session.user.authVersion=token.authVersion;
   return session;
  },
 },
}));
