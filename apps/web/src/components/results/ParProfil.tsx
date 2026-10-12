import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cx } from '@/lib/cx';
import { formatEuro, nombreEtUnite, typo } from '@/lib/format';
import { colonnesParProfil, lignesParProfil } from '@/lib/resultats';
import type { BlocResultat, ColonnesParProfil, EtatEnTete, LigneParProfil } from '@/lib/resultats';

const ID_TITRE = 'titre-par-profil';

const personnes = (n: number): string => nombreEtUnite(n, n > 1 ? 'personnes' : 'personne');

/** Colonnes montrées quand le tableau existe : le coût seul, ou le coût, le financé et le reste à charge. */
type Colonnes = Exclude<ColonnesParProfil, 'aucune'>;

/** Ce que l'écran écrit à la place du financé et du reste à charge d'un profil dont le propre plan n'est pas chiffré. */
const NON_CHIFFRE = 'Non chiffré';

/** Chapeau de la section et légende du tableau, selon les colonnes montrées. */
const TEXTES: Record<Colonnes, { chapeau: string; legende: string }> = {
  toutes: {
    chapeau: 'Coût, financement et reste à charge de chaque profil, pour toutes ses personnes.',
    legende: 'Coût, financement et reste à charge de chaque profil du groupe',
  },
  cout: {
    chapeau: 'Coût de chaque profil, pour toutes ses personnes.',
    legende: 'Coût de chaque profil du groupe',
  },
};

/** Un montant d'un profil sous 640 px, ou « Non chiffré » quand `valeur` est nulle. */
function Montant({ libelle, valeur, couleur }: { libelle: string; valeur: number | null; couleur: string }) {
  return (
    <div>
      <dt className="text-texte-discret">{libelle}</dt>
      {valeur == null ? (
        <dd className="mt-0.5 text-texte-discret">{NON_CHIFFRE}</dd>
      ) : (
        <dd className={cx('amount mt-0.5', couleur)}>{formatEuro(valeur)}</dd>
      )}
    </div>
  );
}

/**
 * Les montants d'un profil sous 640 px : le coût, puis, quand le plan du groupe est chiffré, le financé et le reste à charge
 * (« Non chiffré » pour un profil dont le propre plan ne l'est pas ; `chiffre` vaut vrai pour le total, qui est le plan du
 * groupe).
 */
function Montants({
  ligne,
  colonnes,
  chiffre,
}: {
  ligne: Pick<LigneParProfil, 'cout' | 'finance' | 'reste'>;
  colonnes: Colonnes;
  chiffre: boolean;
}) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <Montant libelle="Coût" valeur={ligne.cout} couleur="text-texte" />
      {colonnes === 'toutes' && (
        <>
          <Montant libelle="Financé" valeur={chiffre ? ligne.finance : null} couleur="text-turquoise-deep" />
          <Montant libelle="Reste à charge" valeur={chiffre ? ligne.reste : null} couleur="text-orange-deep" />
        </>
      )}
    </dl>
  );
}

/**
 * Cellule de montant du tableau (une ligne de profil) : le montant, ou « Non chiffré » quand `valeur` est nulle. `marge` : le
 * remplissage horizontal de la colonne (la colonne de droite a la même marge que celle de gauche).
 */
function Cellule({ valeur, couleur, marge }: { valeur: number | null; couleur: string; marge: 'px-3' | 'px-6' }) {
  return valeur == null ? (
    <td className={cx(marge, 'py-4 text-right align-top text-texte-discret')}>{NON_CHIFFRE}</td>
  ) : (
    <td className={cx('amount', marge, 'py-4 text-right align-top', couleur)}>{formatEuro(valeur)}</td>
  );
}

/**
 * Détail par profil d'un groupe de plusieurs profils : coût, financé et reste à charge de chacun, puis le total, qui est le
 * plan du groupe (celui du bandeau). Les chiffres sont ceux du plan de chaque profil (`lignesParProfil`), jamais recalculés
 * ici. L'état du bandeau du groupe (`etat`) gouverne les colonnes (`colonnesParProfil`), pour ne jamais écrire ce que le
 * bandeau refuse : coût inconnu, rien (le bandeau explique) ; aucun financement chiffré, le coût seul ; plan chiffré, les
 * trois montants, où un profil dont le propre plan n'est pas chiffré (un apprenti parmi des salariés) dit « Non chiffré » au
 * lieu d'un « 0 € ». À partir de 640 px et à l'impression, un tableau (une ligne ne se coupe pas entre deux pages) ; en
 * dessous, un bloc empilé par profil. Un seul profil : rien (le bandeau dit déjà tout).
 */
export function ParProfil({
  blocs,
  etat,
}: {
  blocs: readonly Pick<BlocResultat, 'profil' | 'plan'>[];
  /** État du bandeau du groupe (`etatEnTete` du plan du groupe). */
  etat: EtatEnTete;
}) {
  const colonnes = colonnesParProfil(etat);
  if (blocs.length < 2 || colonnes === 'aucune') return null;
  const { lignes, total } = lignesParProfil(blocs);
  // Colonne de droite du tableau : la même marge que la colonne de gauche (6), les colonnes du milieu en ont moins (3).
  const marge = colonnes === 'cout' ? 'px-6' : 'px-3';
  return (
    <section aria-labelledby={ID_TITRE} className="space-y-6">
      <SectionTitle
        as="h2"
        taille="sous-section"
        id={ID_TITRE}
        surtitre="Groupe"
        titre="Détail par profil"
        chapeau={TEXTES[colonnes].chapeau}
      />
      <Card padding="none" className="overflow-hidden break-inside-avoid">
        <ul role="list" className="divide-y divide-filet sm:hidden print:hidden">
          {lignes.map((l) => (
            <li key={l.id} className="px-4 py-4">
              <p className="font-semibold text-texte">
                Profil {l.rang}, {personnes(l.nombre)}
              </p>
              <p className="mt-0.5 text-sm text-texte-doux">{typo(l.libelle)}</p>
              <Montants ligne={l} colonnes={colonnes} chiffre={l.chiffre} />
            </li>
          ))}
          <li className="bg-lin-soft px-4 py-4">
            <p className="font-semibold text-texte">Total, {personnes(total.nombre)}</p>
            <Montants ligne={total} colonnes={colonnes} chiffre />
          </li>
        </ul>

        <table className="hidden w-full border-collapse text-sm sm:table print:table">
          <caption className="sr-only">{TEXTES[colonnes].legende}</caption>
          <thead>
            <tr className="border-b border-filet text-xs tracking-[0.08em] text-texte-discret uppercase">
              <th scope="col" className="px-6 py-3 text-left font-semibold">
                Profil
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Personnes
              </th>
              <th scope="col" className={cx(marge, 'py-3 text-right font-semibold')}>
                Coût
              </th>
              {colonnes === 'toutes' && (
                <>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Financé
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">
                    Reste à charge
                  </th>
                </>
              )}
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
                <Cellule valeur={l.cout} couleur="text-texte" marge={marge} />
                {colonnes === 'toutes' && (
                  <>
                    <Cellule valeur={l.chiffre ? l.finance : null} couleur="text-turquoise-deep" marge="px-3" />
                    <Cellule valeur={l.chiffre ? l.reste : null} couleur="text-orange-deep" marge="px-6" />
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="break-inside-avoid border-t-2 border-filet-fort bg-lin-soft">
              <th scope="row" className="px-6 py-4 text-left font-semibold text-texte">
                Total
              </th>
              <td className="amount px-3 py-4 text-right text-texte">{total.nombre}</td>
              <td className={cx('amount', marge, 'py-4 text-right text-texte')}>{formatEuro(total.cout)}</td>
              {colonnes === 'toutes' && (
                <>
                  <td className="amount px-3 py-4 text-right text-turquoise-deep">{formatEuro(total.finance)}</td>
                  <td className="amount px-6 py-4 text-right text-orange-deep">{formatEuro(total.reste)}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </Card>
    </section>
  );
}
