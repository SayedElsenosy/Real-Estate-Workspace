import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = { reactStrictMode: true, async headers() { return [{ source: "/invite/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"}] }]; } };
export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
