import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOVA — American cars. Global buyers.",
  description:
    "MOVA connects U.S. vehicle sellers with international buyers, starting in Nigeria.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
