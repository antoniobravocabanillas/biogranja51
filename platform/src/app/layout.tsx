import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://biogranja51.com"),
  title: {
    default: "BioGranja 51 | Alimentación confiable y proteínas premium",
    template: "%s | BioGranja 51",
  },
  description:
    "Proteínas premium para hogares de Trujillo con origen claro, entrega coordinada y una operación moderna en construcción.",
  openGraph: {
    title: "BioGranja 51 | Alimentación confiable y proteínas premium",
    description:
      "Pollo propio y carnes seleccionadas con origen honesto y experiencia premium para tu hogar.",
    locale: "es_PE",
    siteName: "BioGranja 51",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${playfairDisplay.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  );
}
