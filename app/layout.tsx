import type { Metadata } from "next";
import { Archivo, DM_Sans } from "next/font/google";
import { Header } from "@/components/ui/header";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Footer } from "@/components/ui/footer";
import { PrelaunchBanner } from "@/components/ui/prelaunch-banner";
import "./globals.css";

// The only two fonts (redesign PR A). next/font self-hosts them and sizes a
// matching fallback, so the swap doesn't shift the layout.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  // Absolute URLs in metadata (Open Graph etc.) always point at shipmova.com.
  metadataBase: new URL("https://shipmova.com"),
  title: "ShipMova — American cars. Global buyers.",
  description:
    "Buy directly from verified U.S. sellers. Your payment is held by Escrow.com, and the seller isn't paid until the car is inspected and in your shipper's hands.",
  applicationName: "ShipMova",
  // Image comes from app/opengraph-image.png (logo on black, 1200x630).
  openGraph: {
    type: "website",
    siteName: "ShipMova",
    title: "ShipMova — American cars. Global buyers.",
    description:
      "Buy directly from verified U.S. sellers, with your payment held by Escrow.com until the car is inspected and with your shipper.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShipMova — American cars. Global buyers.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${archivo.variable}`}>
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
