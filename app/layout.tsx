import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AccountMenu } from "@/components/ui/account-menu";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
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
    "MOVA connects U.S. vehicle sellers with international buyers, starting in Nigeria.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <AccountMenu />
        <WhatsAppButton />
      </body>
    </html>
  );
}
