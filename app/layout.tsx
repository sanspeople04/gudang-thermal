import type { Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-barlow" });
const barlowCondensed = Barlow_Condensed({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-barlow-condensed" });
const ibmMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-ibm-plex-mono" });

export const metadata = { title: "Gudang Thermal" };

// viewportFit "cover" + env(safe-area-inset-*) agar tidak tertutup notch / tepi layar HP
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#23322B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${barlow.variable} ${barlowCondensed.variable} ${ibmMono.variable} font-sans bg-page text-primary selection:bg-accent selection:text-primary`}>
        {children}
      </body>
    </html>
  );
}