import NextAuth from "next-auth";
import authConfig from "./auth.config";
// Route groups are not URL segments. Match each URL mounted under app/(workspace).
// This verifies the encrypted JWT at the edge. Pages/APIs also revalidate DB membership.
export default NextAuth(authConfig).auth;
export const config = {
 matcher: ["/dashboard/:path*", "/projects/:path*", "/inventory/:path*",
  "/bookings/:path*", "/customers/:path*", "/contracts/:path*", "/treasury/:path*",
  "/reports/:path*", "/settings/:path*"],
};
