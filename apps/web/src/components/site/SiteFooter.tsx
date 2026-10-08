import Link from 'next/link';
import { EMBEDDED_OPCOS } from '@opco/core';
import { moisAnneeFr, verificationLaPlusRecente } from '@/lib/format';
import { Logo } from '@/components/site/Logo';
import { Icon } from '@/components/ui/Icon';

/**
 * Vérification la plus récente des barèmes parmi les 11 OPCO : le pied de page annonce la fraîcheur des données, pas la
 * date du build. Composant serveur : les données des OPCO ne partent pas dans le code envoyé au navigateur.
 */
const DERNIERE_VERIFICATION = verificationLaPlusRecente(EMBEDDED_OPCOS);
const CRITERES = DERNIERE_VERIFICATION
  ? `Critères 2026 · vérifiés ${moisAnneeFr(DERNIERE_VERIFICATION)}`
  : 'Critères 2026';

const PAGES = [
  { href: '/simulateur', label: 'Simulateur de financement' },
  { href: '/comprendre-les-opco', label: 'Comprendre les OPCO' },
  { href: '/obligations', label: 'Obligations des entreprises' },
  { href: '/former-sans-budget', label: 'Se former sans budget' },
  { href: '/opco', label: 'Fiches des 11 OPCO' },
  { href: '/contact', label: 'Nous contacter' },
];

const SOURCES = [
  { href: 'https://travail-emploi.gouv.fr', label: 'Ministère du Travail' },
  { href: 'https://www.francecompetences.fr', label: 'France compétences' },
  { href: 'https://www.urssaf.fr', label: 'Urssaf' },
  { href: 'https://www.moncompteformation.gouv.fr', label: 'Mon Compte Formation' },
];

/* Transition limitée à la couleur du texte : l'anneau de focus apparaît d'emblée en or, sans fondu depuis le blanc. */
const LIEN =
  'inline-flex min-h-11 items-center gap-1.5 text-white/80 underline-offset-4 transition-[color] hover:text-white hover:underline lg:min-h-0 lg:py-1';

export function SiteFooter() {
  return (
    <footer className="surface-encre mt-16 print:hidden">
      {/* Les trois couleurs du slogan de marque, en filet */}
      <div aria-hidden="true" className="flex h-1">
        <span className="flex-1 bg-turquoise" />
        <span className="flex-1 bg-or" />
        <span className="flex-1 bg-orange" />
      </div>

      {/* Les deux listes de liens côte à côte dès le téléphone : le pied garde ses cibles de 44 px sans s'étirer sur
          plus d'un écran. */}
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:py-14 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-10">
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="-m-1.5 inline-block rounded-xl p-1.5">
            <Logo fond="sombre" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
            Un service SFG Développement. Les montants proviennent des critères publiés par les 11 opérateurs de
            compétences et sont donnés à titre indicatif : seul votre OPCO confirme une prise en charge, après étude
            du dossier.
          </p>
          <a
            href="mailto:contact@sfgdeveloppement.fr"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-vert-clair underline-offset-4 hover:underline"
          >
            <Icon name="courriel" className="size-[18px]" />
            contact@sfgdeveloppement.fr
          </a>
        </div>

        <nav aria-label="Pages du site">
          <p className="surtitre mb-3">Naviguer</p>
          <ul className="text-sm lg:space-y-1.5">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link className={LIEN} href={p.href}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="surtitre mb-3">Sources officielles</p>
          <ul className="text-sm lg:space-y-1.5">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a className={LIEN} href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                  <Icon name="lien-externe" className="size-3.5 text-white/60" />
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-white/65 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>Estimations indicatives, ne constitue ni un conseil juridique ni un engagement de financement.</p>
          <p className="inline-flex shrink-0 items-center gap-2 font-medium whitespace-nowrap text-white/80">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-vert-clair" />
            {CRITERES}
          </p>
        </div>
      </div>
    </footer>
  );
}
