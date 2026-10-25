import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "[Project Name] | Foundation", description: "Foundational real-estate SaaS — Stage 1 only" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
