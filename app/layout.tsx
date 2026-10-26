import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={
 title:"BUNYRA | Real Estate ERP & CRM",
 description:"منصة إدارة المشروعات العقارية والمخزون والحجوزات والعقود والمقبوضات",
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="ar" dir="rtl"><body className="antialiased">{children}</body></html>;
}
