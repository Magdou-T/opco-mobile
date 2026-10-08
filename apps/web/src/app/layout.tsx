import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ADRESSE_DU_SITE, GABARIT_DU_TITRE, PAGES } from "@/lib/metadonnees";

// Charte SFG : titres en Montserrat (SemiBold, Bold), texte en Inter (Regular ; Medium et SemiBold pour l'interface).
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Valeurs par défaut : chaque page déclare ses propres métadonnées (lib/metadonnees.ts : adresse canonique, Open Graph,
// carte Twitter). `metadataBase` résout leurs chemins en adresses absolues.
export const metadata: Metadata = {
  metadataBase: new URL(ADRESSE_DU_SITE),
  title: {
    default: PAGES.accueil.titre,
    template: GABARIT_DU_TITRE,
  },
  description: PAGES.accueil.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-papier text-texte">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-texte focus:shadow-flottante"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <div id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
