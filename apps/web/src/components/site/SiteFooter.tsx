import Link from 'next/link';
import { EMBEDDED_OPCOS } from '@opco/core';
import { moisAnneeFr } from '@/lib/format';

/**
 * Vérification la plus récente des barèmes parmi les 11 OPCO : le pied de page annonce la fraîcheur des données, pas la
 * date du build (AAAA-MM-JJ : l'ordre alphabétique est l'ordre chronologique). Composant serveur : les données des OPCO
 * ne partent pas dans le code envoyé au navigateur.
 */
const DERNIERE_VERIFICATION = EMBEDDED_OPCOS.reduce(
  (recente, o) => (o.derniere_verification && o.derniere_verification > recente ? o.derniere_verification : recente),
  '',
);
const CRITERES = DERNIERE_VERIFICATION
  ? `Critères 2026 · vérifiés ${moisAnneeFr(DERNIERE_VERIFICATION)}`
  : 'Critères 2026';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink bg-navy text-paper print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-display text-lg font-extrabold">
            financement<span className="text-marker">OPCO</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper/70">
            Un service SFG Développement. Les montants proviennent des critères publiés
            par les 11 opérateurs de compétences et sont donnés à titre indicatif : seul
            votre OPCO confirme une prise en charge après étude du dossier.
          </p>
          <a
            href="mailto:contact@sfgdeveloppement.fr"
            className="mt-3 inline-block text-sm font-semibold text-marker hover:underline"
          >
            contact@sfgdeveloppement.fr
          </a>
        </div>
        <nav aria-label="Pages du site">
          <div className="marginalia mb-3 !text-paper/50">Naviguer</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:underline" href="/simulateur">Simulateur de financement</Link></li>
            <li><Link className="hover:underline" href="/comprendre-les-opco">Comprendre les OPCO</Link></li>
            <li><Link className="hover:underline" href="/obligations">Obligations des entreprises</Link></li>
            <li><Link className="hover:underline" href="/former-sans-budget">Se former sans budget</Link></li>
            <li><Link className="hover:underline" href="/opco">Fiches des 11 OPCO</Link></li>
            <li><Link className="hover:underline" href="/contact">Nous contacter</Link></li>
          </ul>
        </nav>
        <div>
          <div className="marginalia mb-3 !text-paper/50">Sources officielles</div>
          <ul className="space-y-2 text-sm text-paper/80">
            <li><a className="hover:underline" href="https://travail-emploi.gouv.fr" target="_blank" rel="noopener noreferrer">Ministère du Travail</a></li>
            <li><a className="hover:underline" href="https://www.francecompetences.fr" target="_blank" rel="noopener noreferrer">France compétences</a></li>
            <li><a className="hover:underline" href="https://www.urssaf.fr" target="_blank" rel="noopener noreferrer">Urssaf</a></li>
            <li><a className="hover:underline" href="https://www.moncompteformation.gouv.fr" target="_blank" rel="noopener noreferrer">Mon Compte Formation</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-paper/50 sm:px-6">
          <span>Estimations indicatives, ne constitue ni un conseil juridique ni un engagement de financement.</span>
          <span className="amount">{CRITERES}</span>
        </div>
      </div>
    </footer>
  );
}
