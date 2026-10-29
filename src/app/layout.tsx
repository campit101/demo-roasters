import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { BasketDrawer } from "@/components/basket/BasketDrawer";
import { BasketProvider } from "@/components/basket/BasketProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { indexingAllowed, SITE_NAME, siteUrl } from "@/config/site";
import "./globals.css";

// Self-hosted at build time by next/font: visitors' browsers never contact Google.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME}: a portfolio demo coffee shop`, template: `%s | ${SITE_NAME} (demo)` },
  description: "A pretend specialty coffee shop built as a portfolio demo: catalogue, plain-English search, test checkout. Nothing is sold.",
  applicationName: SITE_NAME,
  robots: indexingAllowed(process.env) ? undefined : { index: false, follow: false },
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_GB" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// Light is the default for everyone (Cam, 23 Oct). Dark only when the visitor chose it with the switch;
// applied before first paint so the page never flashes the wrong colours.
const themeScript = `(function(){try{if(localStorage.getItem("theme")==="dark"){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" data-theme="light" className={bricolage.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        {/* Runs before paint. Pages Next renders in the browser skip it; ThemeToggle covers those (found 23 Oct). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        <BasketProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <BasketDrawer />
        </BasketProvider>
      </body>
    </html>
  );
}
