import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/ui/header";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Footer } from "@/components/ui/footer";
import { PrelaunchBanner } from "@/components/ui/prelaunch-banner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MOVA — American cars. Global buyers.",
  description:
    "Buy directly from verified U.S. sellers. Your payment is held by Escrow.com, and the seller isn't paid until the car is inspected and in your shipper's hands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <PrelaunchBanner />
        <Header />
        {children}
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
