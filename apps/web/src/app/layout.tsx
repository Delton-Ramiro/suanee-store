import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-figtree-var",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Suanee — Moda Moçambicana",
    template: "%s | Suanee",
  },
  description:
    "Descubra moda contemporânea moçambicana. Roupas, calçados e acessórios com entrega ao domicílio.",
  openGraph: {
    siteName: "Suanee",
    locale: "pt_MZ",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" className={figtree.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
