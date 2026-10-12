import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { formatEuro, nombreEtUnite, typo } from '@/lib/format';
import { lignesParProfil } from '@/lib/resultats';
import type { BlocResultat, LigneParProfil } from '@/lib/resultats';

const ID_TITRE = 'titre-par-profil';

const personnes = (n: number): string => nombreEtUnite(n, n > 1 ? 'personnes' : 'personne');

/** Les trois montants d'un profil sous 640 px : coût, financé, reste à charge. */
function Montants({ ligne }: { ligne: Pick<LigneParProfil, 'cout' | 'finance' | 'reste'> }) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <div>
        <dt className="text-texte-discret">Coût</dt>
        <dd className="amount mt-0.5 text-texte">{formatEuro(ligne.cout)}</dd>
      </div>
      <div>
        <dt className="text-texte-discret">Financé</dt>
        <dd className="amount mt-0.5 text-turquoise-deep">{formatEuro(ligne.finance)}</dd>
      </div>
      <div>
        <dt className="text-texte-discret">Reste à charge</dt>
        <dd className="amount mt-0.5 text-orange-deep">{formatEuro(ligne.reste)}</dd>
      </div>
    </dl>
  );
}

/**
 * Détail par profil d'un groupe de plusieurs profils : coût, financé et reste à charge de chacun, puis le total. Les
 * chiffres sont ceux du plan de chaque profil (`lignesParProfil`), jamais recalculés ici. À partir de 640 px et à
 * l'impression, un tableau (une ligne ne se coupe pas entre deux pages) ; en dessous, un bloc empilé par profil. Un seul
 * profil : rien (le bandeau dit déjà tout).
 */
export function ParProfil({ blocs }: { blocs: readonly Pick<BlocResultat, 'profil' | 'plan'>[] }) {
  if (blocs.length < 2) return null;
  const { lignes, total } = lignesParProfil(blocs);
  return (
    <section aria-labelledby={ID_TITRE} className="space-y-6">
      <SectionTitle
        as="h2"
        taille="sous-section"
        id={ID_TITRE}
        surtitre="Groupe"
        titre="Détail par profil"
        chapeau="Coût, financement et reste à charge de chaque profil, pour toutes ses personnes."
      />
      <Card padding="none" className="overflow-hidden break-inside-avoid">
        <ul role="list" className="divide-y divide-filet sm:hidden print:hidden">
          {lignes.map((l) => (
            <li key={l.id} className="px-4 py-4">
              <p className="font-semibold text-texte">
                Profil {l.rang}, {personnes(l.nombre)}
              </p>
              <p className="mt-0.5 text-sm text-texte-doux">{typo(l.libelle)}</p>
              <Montants ligne={l} />
            </li>
          ))}
          <li className="bg-lin-soft px-4 py-4">
            <p className="font-semibold text-texte">Total, {personnes(total.nombre)}</p>
            <Montants ligne={total} />
          </li>
        </ul>

        <table className="hidden w-full border-collapse text-sm sm:table print:table">
          <caption className="sr-only">Coût, financement et reste à charge de chaque profil du groupe</caption>
          <thead>
            <tr className="border-b border-filet text-xs tracking-[0.08em] text-texte-discret uppercase">
              <th scope="col" className="px-6 py-3 text-left font-semibold">
                Profil
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Personnes
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Coût
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Financé
              </th>
              <th scope="col" className="px-6 py-3 text-right font-semibold">
                Reste à charge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-filet">
            {lignes.map((l) => (
              <tr key={l.id} className="break-inside-avoid">
                <th scope="row" className="px-6 py-4 text-left align-top font-normal">
                  <span className="block font-semibold text-texte">Profil {l.rang}</span>
                  <span className="mt-0.5 block text-texte-doux">{typo(l.libelle)}</span>
                </th>
                <td className="amount px-3 py-4 text-right align-top text-texte">{l.nombre}</td>
                <td className="amount px-3 py-4 text-right align-top text-texte">{formatEuro(l.cout)}</td>
                <td className="amount px-3 py-4 text-right align-top text-turquoise-deep">{formatEuro(l.finance)}</td>
                <td className="amount px-6 py-4 text-right align-top text-orange-deep">{formatEuro(l.reste)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="break-inside-avoid border-t-2 border-filet-fort bg-lin-soft">
              <th scope="row" className="px-6 py-4 text-left font-semibold text-texte">
                Total
              </th>
              <td className="amount px-3 py-4 text-right text-texte">{total.nombre}</td>
              <td className="amount px-3 py-4 text-right text-texte">{formatEuro(total.cout)}</td>
              <td className="amount px-3 py-4 text-right text-turquoise-deep">{formatEuro(total.finance)}</td>
              <td className="amount px-6 py-4 text-right text-orange-deep">{formatEuro(total.reste)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </section>
  );
}
