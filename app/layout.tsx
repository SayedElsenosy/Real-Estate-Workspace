import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { getServerI18n } from "@/lib/i18n/server";
import "./globals.css";
export const metadata:Metadata={
 title:"BUNYRA | Real Estate ERP & CRM",
 description:"Real estate ERP and CRM platform / منصة إدارة التطوير العقاري",
};
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 const {locale,messages}=await getServerI18n();
 return <html lang={locale} dir={locale==="ar"?"rtl":"ltr"} suppressHydrationWarning>
  <body className="antialiased">
   <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
     {children}
    </NextIntlClientProvider>
   </ThemeProvider>
  </body>
 </html>;
}
