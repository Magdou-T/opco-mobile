import type { ReactNode } from 'react';
import type { AideEvaluee, PlanFinancement } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatEuro, texteDonnees } from '@/lib/format';
import { ID_SECTION_AIDES, encadreSansFinancement } from '@/lib/encadres-resultats';
import { partFinancee, partsBarre } from '@/lib/resultats';
import type { EtatEnTete, PartBarre } from '@/lib/resultats';
import { BarreEmpilee } from './BarreEmpilee';
import { FiletTricolore } from './FiletTricolore';

/** L'OPCO signale épuisée l'enveloppe de branches dont le plan compte le plan de développement des compétences. */
export interface FondsEpuises {
  opco: string;
  branches: string[];
}

/**
 * Bandeau de synthèse du plan, selon l'état de l'en-tête (`etatEnTete`) : coût inconnu, aucun financement chiffré, ou
 * plan chiffré (coût, financé, reste à charge, barre empilée par famille de financeurs).
 */
export function BandeauSynthese({
  plan,
  aides,
  etat,
  fondsEpuises,
  avecPortail,
  onModifierFormation,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  etat: EtatEnTete;
  fondsEpuises: FondsEpuises | null;
  /** Les portails officiels de la région figurent plus bas : l'encadré sans financement chiffré peut y renvoyer. */
  avecPortail: boolean;
  onModifierFormation?: () => void;
}) {
  return (
    <div className="apparition overflow-hidden rounded-panneau border border-filet bg-white shadow-douce">
      <FiletTricolore />
      <div className="p-5 sm:p-8">
        {etat === 'cout_inconnu' && <CoutInconnu onModifierFormation={onModifierFormation} />}
        {etat === 'aucun_financement_chiffre' && (
          <AucunFinancementChiffre plan={plan} aides={aides} avecPortail={avecPortail} />
        )}
        {etat === 'plan_chiffre' && (
          <PlanChiffre plan={plan} parts={partsBarre(plan, aides)} fondsEpuises={fondsEpuises} />
        )}
      </div>
    </div>
  );
}

function CoutInconnu({ onModifierFormation }: { onModifierFormation?: () => void }) {
  return (
    <div className="space-y-4">
      <Callout tone="info" titre="Coût de la formation non renseigné">
        Renseignez le coût de la formation pour calculer le reste à charge.
      </Callout>
      {onModifierFormation && (
        <div className="print:hidden">
          <Button variant="secondary" icone="crayon" onClick={onModifierFormation}>
            Indiquer le coût
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Aucun financement de la formation n'est chiffré (alternance, demandeur d'emploi, entreprise de 50 salariés et plus…) :
 * jamais « Financé 0 € » ni « Reste à charge » égal au coût présenté comme un résultat. Le coût reste visible, un encadré
 * dit pourquoi en ne citant que ce que la page montre plus bas (`encadreSansFinancement`), et des liens mènent aux cartes
 * qui portent les aides identifiées et, quand l'encadré les cite, à la liste des aides « à vérifier ».
 */
function AucunFinancementChiffre({
  plan,
  aides,
  avecPortail,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  avecPortail: boolean;
}) {
  const { texte, rappels, aidesAVerifier } = encadreSansFinancement(plan, aides, avecPortail);
  const liens = [
    ...rappels.map((r) => ({ cle: r.carte, href: `#carte-${r.carte}`, libelle: r.libelle })),
    ...(aidesAVerifier ? [{ cle: 'aides-a-verifier', href: `#${ID_SECTION_AIDES}`, libelle: aidesAVerifier.libelle }] : []),
  ];
  return (
    <div>
      <dl className="grid sm:grid-cols-3">
        <Chiffre libelle="Coût de la formation" valeur={formatEuro(plan.coutFormation)} />
      </dl>
      <Callout tone="info" className="mt-5">
        {texte}
      </Callout>
      {liens.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 print:hidden">
          {liens.map((l) => (
            <li key={l.cle}>
              <a
                href={l.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-orange/30 bg-orange-soft px-4 text-sm font-semibold text-orange-deep transition-[border-color] hover:border-orange-deep lg:min-h-9"
              >
                {l.libelle}
                <Icon name="chevron" className="size-4 rotate-90" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanChiffre({
  plan,
  parts,
  fondsEpuises,
}: {
  plan: PlanFinancement;
  parts: PartBarre[];
  fondsEpuises: FondsEpuises | null;
}) {
  const part = partFinancee(parts);
  return (
    <div>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Chiffre libelle="Coût de la formation" valeur={formatEuro(plan.coutFormation)} />
        <Chiffre
          libelle="Financé"
          valeur={<span className="mark">{formatEuro(plan.totalFinance)}</span>}
          detail={part ? `soit ${part}` : undefined}
          grand
        />
        {/* Aucune phrase de couverture sous un reste nul : c'est une estimation, et la prise en charge peut être refusée
            (fonds épuisés, étude du dossier). Le chiffre suffit. */}
        <Chiffre libelle="Reste à charge" valeur={formatEuro(plan.resteACharge)} couleur="text-orange-deep" />
      </dl>
      <BarreEmpilee parts={parts} cout={plan.coutFormation} />
      {fondsEpuises && fondsEpuises.branches.length > 0 && (
        <Callout tone="avertissement" titre={`Fonds épuisés selon ${fondsEpuises.opco}`} className="mt-6">
          {fondsEpuises.opco} signale que l&apos;enveloppe du plan de développement des compétences est épuisée pour{' '}
          {fondsEpuises.branches.length > 1 ? 'les branches' : 'la branche'}{' '}
          {fondsEpuises.branches.map((b, i) => (
            <span key={b}>
              {i > 0 && ', '}«&nbsp;{texteDonnees(b)}&nbsp;»
            </span>
          ))}
          &nbsp;: la prise en charge peut être refusée.{' '}
          <a href="#alertes-opco" className="lien">
            Voir les alertes de l&apos;OPCO
          </a>
        </Callout>
      )}
      <p className="mt-6 flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
        <Icon name="info" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" />
        <span>
          Financements cumulables empilés sans jamais dépasser le coût de la formation. Les aides «&nbsp;à
          vérifier&nbsp;» ne sont pas comptées.
        </span>
      </p>
    </div>
  );
}

/**
 * Chiffre clé (Montserrat 700, chiffres tabulaires). Sous 640 px, une ligne : libellé à gauche, montant à droite, et la
 * précision dessous, alignée à droite ; au-delà, trois colonnes, montant puis précision sous le libellé.
 */
function Chiffre({
  libelle,
  valeur,
  detail,
  grand = false,
  couleur = 'text-texte',
}: {
  libelle: string;
  valeur: ReactNode;
  detail?: string;
  grand?: boolean;
  couleur?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-filet pb-4 last:border-b-0 last:pb-0 sm:block sm:border-b-0 sm:pb-0">
      <dt className="text-sm font-semibold text-texte-doux">{libelle}</dt>
      <dd
        className={cx(
          'amount text-right leading-tight sm:mt-2 sm:text-left',
          couleur,
          grand ? 'text-[2rem] sm:text-[2.625rem]' : 'text-2xl sm:text-[2rem]',
        )}
      >
        {valeur}
      </dd>
      {detail && (
        <dd className="col-span-2 mt-1.5 text-right text-xs font-medium text-texte-discret sm:text-left sm:text-sm">
          {detail}
        </dd>
      )}
    </div>
  );
}
