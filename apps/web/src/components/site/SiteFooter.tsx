import Link from 'next/link';
import type { ReactNode } from 'react';
import { EMBEDDED_OPCOS } from '@opco/core';
import { moisAnneeFr, verificationLaPlusRecente } from '@/lib/format';
import { CONTACT_EMAIL } from '@/lib/contact';
import { LIEN_MENTIONS } from '@/lib/mentions';
import { Logo } from '@/components/site/Logo';
import { Icon } from '@/components/ui/Icon';

/**
 * Vérification la plus récente des barèmes parmi les 11 OPCO : le pied de page annonce la fraîcheur des données, pas la
 * date du build. Composant serveur : les données des OPCO ne partent pas dans le code envoyé au navigateur.
 */
const DERNIERE_VERIFICATION = verificationLaPlusRecente(EMBEDDED_OPCOS);
const CRITERES = DERNIERE_VERIFICATION
  ? `Critères 2026 · vérifiés en ${moisAnneeFr(DERNIERE_VERIFICATION)}`
  : 'Critères 2026';

const PROFILS = [
  { href: '/employeurs', label: 'Employeurs' },
  { href: '/salaries', label: 'Salariés' },
  { href: '/demandeurs-emploi', label: "Demandeurs d'emploi" },
  { href: '/cpf', label: 'Compte personnel de formation' },
  { href: '/a-propos', label: 'Méthode et sources' },
  { href: '/contact', label: 'Nous contacter' },
];

const GUIDES = [
  { href: '/simulateur', label: 'Simulateur de financement' },
  { href: '/quel-est-mon-opco', label: 'Quel est mon OPCO ?' },
  { href: '/comprendre-les-opco', label: 'Comprendre les OPCO' },
  { href: '/obligations', label: 'Obligations des entreprises' },
  { href: '/former-sans-budget', label: 'Se former sans budget' },
  { href: '/alternance', label: 'Alternance' },
  { href: '/opco', label: 'Fiches des 11 OPCO' },
  { href: '/lexique', label: 'Lexique' },
];

const SOURCES = [
  { href: 'https://travail-emploi.gouv.fr', label: 'Ministère du Travail' },
  { href: 'https://www.francecompetences.fr', label: 'France compétences' },
  { href: 'https://www.urssaf.fr', label: 'Urssaf' },
  { href: 'https://www.moncompteformation.gouv.fr', label: 'Mon Compte Formation' },
];

/* Pied de page encre (charte financementopco) : liens en texte clair sur encre (9,25:1), soulignés au survol ; repères
   de colonne en DM Mono, bleu clair (10,07:1). */
const LIEN =
  'inline-flex min-h-11 items-center gap-1.5 text-texte-sur-encre underline-offset-4 transition-[color] hover:text-white hover:underline lg:min-h-0 lg:py-1';

function Colonne({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 border-b border-filet-sur-encre pb-2 font-mono text-xs tracking-[0.06em] text-bleu-clair uppercase">
        {titre}
      </p>
      {children}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="pied-site surface-encre mt-16 print:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="-m-1.5 inline-block rounded-[3px] p-1.5">
            <Logo fond="sombre" taille="compacte" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            Le simulateur des financements de la formation professionnelle, construit à partir des critères publiés par
            les 11 opérateurs de compétences et les autres financeurs.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-mono text-sm text-bleu-clair underline-offset-4 hover:underline"
          >
            <Icon name="courriel" className="size-[18px]" />
            {CONTACT_EMAIL}
          </a>
        </div>

        <nav aria-label="Pages par profil">
          <Colonne titre="Par profil">
            <ul className="text-sm lg:space-y-1.5">
              {PROFILS.map((p) => (
                <li key={p.href}>
                  <Link className={LIEN} href={p.href}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Colonne>
        </nav>

        <nav aria-label="Guides et outils">
          <Colonne titre="Guides et outils">
            <ul className="text-sm lg:space-y-1.5">
              {GUIDES.map((p) => (
                <li key={p.href}>
                  <Link className={LIEN} href={p.href}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Colonne>
        </nav>

        <Colonne titre="Sources officielles">
          <ul className="text-sm lg:space-y-1.5">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a className={LIEN} href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                  <Icon name="lien-externe" className="size-3.5 opacity-70" />
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              </li>
            ))}
          </ul>
        </Colonne>
      </div>

      <div className="border-t border-filet-sur-encre">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl leading-relaxed">
            Estimations indicatives, ne constitue ni un conseil juridique ni un engagement de financement&nbsp;: seul
            votre OPCO confirme une prise en charge, après étude du dossier. Site édité par SFG Développement ·{' '}
            {/* Lien dans la phrase : souligné, il ne se distingue pas du texte par la seule couleur. */}
            <Link
              href={LIEN_MENTIONS.href}
              className="font-medium text-white underline underline-offset-4 transition-[color] hover:text-bleu-clair"
            >
              {LIEN_MENTIONS.libelle}
            </Link>
          </p>
          <p className="shrink-0 font-mono whitespace-nowrap text-texte-sur-encre">{CRITERES}</p>
        </div>
      </div>
    </footer>
  );
}
