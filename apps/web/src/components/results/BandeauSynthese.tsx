import type { ReactNode } from 'react';
import type { AideEvaluee, PlanFinancement } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatEuro } from '@/lib/format';
import {
  ID_DETAIL_OPCO,
  ID_SECTION_AIDES,
  encadrePlanFerme,
  encadreSansFinancement,
  texteFondsEpuises,
  titreFondsEpuises,
} from '@/lib/encadres-resultats';
import type { FondsEpuises, PlanFerme } from '@/lib/encadres-resultats';
import { partFinancee, partsBarre } from '@/lib/resultats';
import type { EtatEnTete, PartBarre, RelaisPlanConventionnel } from '@/lib/resultats';
import { BarreEmpilee } from './BarreEmpilee';
import { FiletTricolore } from './FiletTricolore';

/**
 * Bandeau de synthèse du plan, selon l'état de l'en-tête (`etatEnTete`) : coût inconnu, aucun financement chiffré, ou
 * plan chiffré (coût, financé, reste à charge, barre empilée par famille de financeurs). Plan de développement des
 * compétences fermé aux 50 salariés et plus (`planFerme`) : sa raison est dite ici, avec un lien vers le détail de
 * l'OPCO (dans l'encadré sans financement chiffré, sinon dans un encadré à part).
 */
export function BandeauSynthese({
  plan,
  aides,
  etat,
  fondsEpuises,
  relais,
  planFerme,
  avecPortail,
  onModifierFormation,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  etat: EtatEnTete;
  fondsEpuises: FondsEpuises | null;
  /** Plan conventionnel de la branche en relais (`relaisDuPlanConventionnel`) : dit dans l'encadré des fonds épuisés. */
  relais: RelaisPlanConventionnel | null;
  planFerme: PlanFerme | null;
  /** Les portails officiels de la région figurent plus bas : l'encadré sans financement chiffré peut y renvoyer. */
  avecPortail: boolean;
  onModifierFormation?: () => void;
}) {
  // Coût inconnu ou plan chiffré par d'autres financeurs : la raison du plan fermé dans un encadré à part.
  const ferme = encadrePlanFerme(etat, planFerme);
  const encadreFerme = ferme && (
    <Callout tone="avertissement" titre={ferme.titre} className="mt-6">
      {ferme.texte}{' '}
      <a href={`#${ID_DETAIL_OPCO}`} className="lien">
        Voir le détail de l&apos;OPCO
      </a>
    </Callout>
  );
  return (
    <div className="apparition overflow-hidden rounded-panneau border border-filet bg-white shadow-douce">
      <FiletTricolore />
      <div className="p-5 sm:p-8">
        {etat === 'cout_inconnu' && (
          <>
            <CoutInconnu onModifierFormation={onModifierFormation} />
            {encadreFerme}
          </>
        )}
        {etat === 'aucun_financement_chiffre' && (
          <AucunFinancementChiffre plan={plan} aides={aides} avecPortail={avecPortail} planFerme={planFerme} />
        )}
        {etat === 'plan_chiffre' && (
          <PlanChiffre
            plan={plan}
            parts={partsBarre(plan, aides)}
            fondsEpuises={fondsEpuises}
            relais={relais}
            encadreFerme={encadreFerme}
          />
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
  planFerme,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  avecPortail: boolean;
  planFerme: PlanFerme | null;
}) {
  const { texte, rappels, aidesAVerifier, detailOpco } = encadreSansFinancement(plan, aides, avecPortail, planFerme);
  const liens = [
    // Plan de l'OPCO fermé : sa raison ouvre le texte, le premier lien mène au détail de l'OPCO.
    ...(detailOpco ? [{ cle: 'detail-opco', href: `#${ID_DETAIL_OPCO}`, libelle: "Détail de l'OPCO" }] : []),
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
  relais,
  encadreFerme,
}: {
  plan: PlanFinancement;
  parts: PartBarre[];
  fondsEpuises: FondsEpuises | null;
  relais: RelaisPlanConventionnel | null;
  /** Raison du plan de l'OPCO fermé, quand d'autres financeurs chiffrent le plan. */
  encadreFerme: ReactNode;
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
        <Callout tone="avertissement" titre={titreFondsEpuises(fondsEpuises, relais)} className="mt-6">
          {texteFondsEpuises(fondsEpuises, relais)}{' '}
          <a href="#alertes-opco" className="lien">
            Voir les alertes de l&apos;OPCO
          </a>
        </Callout>
      )}
      {encadreFerme}
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
