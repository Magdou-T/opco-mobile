import type { Metadata, Viewport } from "next";
import { DM_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { DonneesStructurees } from "@/components/site/DonneesStructurees";
import { grapheDuSite } from "@/lib/donnees-structurees";
import { SCRIPT_DETECTION_INTEGRATION } from "@/lib/integration";
import { ADRESSE_DU_SITE, GABARIT_DU_TITRE, PAGES } from "@/lib/metadonnees";

// Charte financementopco (kit d'identité de novembre 2026) : titres en Newsreader (500, italique pour l'accent, axe de
// taille optique), texte en Instrument Sans (400 et 600), montants, sources et repères en DM Mono (400 et 500).
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/** Couleur de la barre du navigateur mobile : le bleu de Prusse de la charte. */
export const viewport: Viewport = {
  themeColor: "#1F3B63",
};

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
    // suppressHydrationWarning : le script de l'en-tête pose l'attribut data-integre sur <html> avant l'hydratation
    // (mode intégré, lib/integration.ts), React ne doit pas y voir une différence.
    <html lang="fr" className={`${newsreader.variable} ${instrument.variable} ${dmMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DETECTION_INTEGRATION }} />
        {/* Éditeur et site (Schema.org) : chaque page y renvoie par leur @id (lib/donnees-structurees.ts). */}
        <DonneesStructurees graphe={grapheDuSite()} />
      </head>
      <body className="flex min-h-full flex-col bg-papier text-texte">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[3px] focus:bg-feuille focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-texte focus:outline-2 focus:outline-texte"
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
