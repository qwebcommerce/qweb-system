import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic, NTR } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const ntr = NTR({
  variable: "--font-ntr",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Qweb",
    template: "%s · Qweb",
  },
  description: "Private company management system",
  icons: {
    icon: "/brand/mark.png",
    apple: "/brand/mark.png",
  },
};

const localeBootScript = `try{var l=localStorage.getItem("qweb-locale");var h=document.documentElement;if(l==="ar"){h.lang="ar";h.dir="rtl"}else{h.lang="en";h.dir="ltr"}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${ntr.variable} ${geistMono.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
