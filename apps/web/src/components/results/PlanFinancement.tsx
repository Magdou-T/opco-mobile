import type { CSSProperties, ReactNode } from 'react';
import type { AideEvaluee, Confidence, DispositifEligible, LignePlan, OptionPlan, PlanFinancement } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { delai } from '@/lib/apparition';
import { cx } from '@/lib/cx';
import { formatEuro, texteDonnees, typo } from '@/lib/format';
import type { FondsEpuises, PlanFerme } from '@/lib/encadres-resultats';
import { cartesDuPlan, confianceDOption, etatEnTete, financeurDeLigne, libellesDeLigne } from '@/lib/resultats';
import type { CartePlan, RelaisPlanConventionnel } from '@/lib/resultats';
import { BandeauSynthese } from './BandeauSynthese';
import { PastilleFinanceur } from './Financeur';

/**
 * Plan de financement : bandeau de synthèse (coût, financé, reste à charge, barre empilée par famille de financeurs :
 * `BandeauSynthese`), puis une carte par catégorie (financement de la formation en pile, options, aides à l'employeur,
 * revenus et aides à la personne, avantages fiscaux et sociaux, montant selon dossier, services gratuits). Chaque montant
 * est celui du moteur, arrondi à l'affichage seulement ; une carte vide n'est pas rendue. Règles de présentation :
 * `lib/resultats.ts`.
 */
export function PlanFinancementCard({
  plan,
  aides,
  dispositifs = [],
  fondsEpuises = null,
  relais = null,
  planFerme = null,
  avecPortail = false,
  apresBandeau,
  onModifierFormation,
}: {
  plan: PlanFinancement;
  /** Aides évaluées : elles donnent le financeur (donc la couleur) de chaque ligne du plan. */
  aides: readonly AideEvaluee[];
  /** Dispositifs de l'OPCO : la fiabilité d'une option « opco-<dispositif> » est la leur (`confianceDOption`). */
  dispositifs?: readonly DispositifEligible[];
  /** Fonds épuisés signalés par l'OPCO (`fondsEpuisesSurLePlan`) : dit à côté du montant financé. */
  fondsEpuises?: FondsEpuises | null;
  /** Plan conventionnel de la branche en relais : il nomme la ligne de l'OPCO (`libellesDeLigne`) et l'encadré. */
  relais?: RelaisPlanConventionnel | null;
  /** Plan de l'OPCO fermé aux 50 salariés et plus : sa raison, dans le bandeau. */
  planFerme?: PlanFerme | null;
  /** Les portails officiels de la région figurent plus bas sur l'écran. */
  avecPortail?: boolean;
  /** Note posée juste après le bandeau (par exemple « Aucun OPCO renseigné ») : les chiffres restent en tête. */
  apresBandeau?: ReactNode;
  /** Retour à l'étape Formation, proposé quand le coût n'est pas renseigné. */
  onModifierFormation?: () => void;
}) {
  const etat = etatEnTete(plan);
  return (
    <div className="space-y-5">
      <BandeauSynthese
        plan={plan}
        aides={aides}
        etat={etat}
        fondsEpuises={fondsEpuises}
        relais={relais}
        planFerme={planFerme}
        avecPortail={avecPortail}
        onModifierFormation={onModifierFormation}
      />
      {apresBandeau}
      {cartesDuPlan(plan).map((carte, i) => (
        <CarteDuPlan
          key={carte}
          carte={carte}
          plan={plan}
          aides={aides}
          dispositifs={dispositifs}
          relais={relais}
          style={delai(120 + i * 70)}
        />
      ))}
    </div>
  );
}

// --- Cartes du plan -----------------------------------------------------------------------------------------------

const CARTES: Record<CartePlan, { titre: string; icone: IconName; aide: string }> = {
  financements: {
    titre: 'Financement de la formation',
    icone: 'euro',
    aide: "Dans l'ordre où ils s'appliquent : chacun couvre une part de ce qui reste à payer.",
  },
  options: {
    titre: 'Options au choix (non additionnées)',
    icone: 'virage',
    aide: "Elles ne s'additionnent pas au plan : chacune se choisit à la place d'un autre financement.",
  },
  employeur: {
    titre: "Aides versées à l'employeur",
    icone: 'batiment',
    aide: "Elles ne réduisent pas le prix de la formation mais le coût global du projet pour l'entreprise.",
  },
  personne: {
    titre: 'Revenus et aides à la personne',
    icone: 'personne',
    aide:
      "Rémunération de stage, aides au transport, à l'hébergement, au permis de conduire, à la mobilité… versées à la personne en formation : elles ne réduisent pas le prix de la formation.",
  },
  avantages: {
    titre: 'Avantages fiscaux et sociaux',
    icone: 'calculatrice',
    aide: "Exonérations et crédits d'impôt : ils allègent les charges de l'entreprise, pas le prix de la formation.",
  },
  'non-chiffrees': {
    titre: 'Montant selon dossier',
    icone: 'document',
    aide: "Éligibles, mais le montant dépend de l'étude du dossier par le financeur.",
  },
  services: {
    titre: 'Services gratuits',
    icone: 'info',
    aide: 'Conseil et accompagnement sans frais pour préparer le projet.',
  },
};

function CarteDuPlan({
  carte,
  plan,
  aides,
  dispositifs,
  relais,
  style,
}: {
  carte: CartePlan;
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  dispositifs: readonly DispositifEligible[];
  relais: RelaisPlanConventionnel | null;
  style: CSSProperties;
}) {
  const { titre, icone, aide } = CARTES[carte];
  const id = `carte-${carte}`;
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="apparition" style={style}>
      <Card padding="none">
        <header className="flex items-start gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-turquoise-soft text-turquoise-deep"
          >
            <Icon name={icone} className="size-[22px]" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 id={`${id}-titre`} className="text-lg leading-snug font-bold text-texte">
              {titre}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-texte-doux">{typo(aide)}</p>
          </div>
        </header>
        <ContenuDeCarte carte={carte} plan={plan} aides={aides} dispositifs={dispositifs} relais={relais} />
      </Card>
    </section>
  );
}

function ContenuDeCarte({
  carte,
  plan,
  aides,
  dispositifs,
  relais,
}: {
  carte: CartePlan;
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  dispositifs: readonly DispositifEligible[];
  relais: RelaisPlanConventionnel | null;
}) {
  switch (carte) {
    case 'financements':
      return <PileDesFinancements plan={plan} aides={aides} relais={relais} />;
    case 'options':
      return (
        <Lignes>
          {plan.options.map((o) => (
            <LigneOption key={o.id} option={o} aides={aides} dispositifs={dispositifs} />
          ))}
        </Lignes>
      );
    case 'employeur':
      return <LignesChiffrees lignes={plan.aidesEmployeur} aides={aides} />;
    case 'personne':
      return <LignesChiffrees lignes={plan.remunerations} aides={aides} />;
    case 'avantages':
      return <LignesChiffrees lignes={plan.avantagesFiscauxSociaux} aides={aides} />;
    case 'non-chiffrees':
      return <LignesDAides aides={plan.nonChiffrees} />;
    case 'services':
      return <LignesDAides aides={plan.servicesGratuits} />;
  }
}

/**
 * Lignes d'une carte du plan, en liste : le lecteur d'écran annonce leur nombre. `role="list"` : Safari et VoiceOver
 * retirent le rôle de liste d'une liste sans puces (`list-style: none`, réglage de base de Tailwind).
 */
function Lignes({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className="divide-y divide-filet border-t border-filet">
      {children}
    </ul>
  );
}

/** Fiabilité d'une ligne : étiquette, et la mention d'estimation quand le montant n'est pas exact. */
function Fiabilite({ confidence }: { confidence: Confidence }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <ConfidenceBadge confidence={confidence} />
      {confidence !== 'exact' && (
        <span className="text-xs text-texte-discret">estimation à confirmer auprès du financeur</span>
      )}
    </div>
  );
}

/** Nom, financeur et fiabilité d'une ligne chiffrée. */
function Identite({ nom, financeurNom, confidence }: { nom: string; financeurNom: string; confidence?: Confidence }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="leading-snug font-semibold text-texte">{typo(nom)}</p>
      <p className="mt-0.5 text-sm leading-snug text-texte-doux">{typo(financeurNom)}</p>
      {confidence && <Fiabilite confidence={confidence} />}
    </div>
  );
}

/** Montant d'une ligne, à droite ; `total` : le total de la pile, plus grand, en turquoise foncé (6,26:1 sur blanc). */
function Montant({ valeur, total = false, className }: { valeur: number; total?: boolean; className?: string }) {
  return (
    <p
      className={cx(
        'amount shrink-0 text-right',
        total ? 'text-xl text-turquoise-deep sm:text-2xl' : 'text-lg text-texte sm:text-xl',
        className,
      )}
    >
      {formatEuro(valeur)}
    </p>
  );
}

/**
 * Financement de la formation : les lignes dans l'ordre d'empilement, chacune plafonnée par le moteur à ce qui reste à
 * payer ; avec plusieurs lignes, un fil les relie jusqu'au total, plafonné au coût de la formation (seule carte à total).
 */
function PileDesFinancements({
  plan,
  aides,
  relais,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  relais: RelaisPlanConventionnel | null;
}) {
  const plusieurs = plan.financements.length > 1;
  return (
    <div className="border-t border-filet px-5 py-5 sm:px-6">
      {/* Liste ordonnée (l'ordre d'empilement) ; `role="list"` : voir `Lignes`. */}
      <ol role="list">
        {plan.financements.map((l) => (
          <li key={l.id} className={cx('relative flex items-start gap-4 break-inside-avoid', plusieurs && 'pb-6')}>
            {plusieurs && (
              <span
                aria-hidden="true"
                className="absolute top-12 bottom-0 left-5 w-0.5 -translate-x-1/2 rounded-full bg-filet"
              />
            )}
            <PastilleFinanceur financeur={financeurDeLigne(l.id, aides)} />
            <Identite {...libellesDeLigne(l, relais)} confidence={l.confidence} />
            <Montant valeur={l.montant} className="pt-1" />
          </li>
        ))}
      </ol>
      {plusieurs && (
        <div className="flex items-center gap-4 break-inside-avoid">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-turquoise-deep bg-white text-turquoise-deep ring-4 ring-white"
          >
            <Icon name="coche" className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-semibold text-texte">Total financé</p>
            <p className="mt-0.5 text-sm leading-snug text-texte-doux">
              plafonné au coût de la formation, {formatEuro(plan.coutFormation)}
            </p>
          </div>
          <Montant valeur={plan.totalFinance} total />
        </div>
      )}
    </div>
  );
}

function LignesChiffrees({ lignes, aides }: { lignes: LignePlan[]; aides: readonly AideEvaluee[] }) {
  return (
    <Lignes>
      {lignes.map((l) => (
        <li key={l.id} className="flex items-start gap-4 px-5 py-4 break-inside-avoid sm:px-6">
          <PastilleFinanceur financeur={financeurDeLigne(l.id, aides)} taille="petite" className="mt-0.5" />
          <Identite nom={l.nom} financeurNom={l.financeurNom} confidence={l.confidence} />
          <Montant valeur={l.montant} />
        </li>
      ))}
    </Lignes>
  );
}

/**
 * Option au choix : montant (ou « montant selon dossier »), financeur, fiabilité du montant comme sur les lignes du plan
 * (`confianceDOption` : celle de l'aide ou du dispositif de l'OPCO) et raison. La raison « Au choix avec « X » » nomme
 * une aide qui peut ne figurer dans aucune liste (coût déjà couvert, solde CPF épuisé) : texte simple, sans lien.
 */
function LigneOption({
  option,
  aides,
  dispositifs,
}: {
  option: OptionPlan;
  aides: readonly AideEvaluee[];
  dispositifs: readonly DispositifEligible[];
}) {
  const montant = option.montantEstime;
  const confidence = confianceDOption(option, aides, dispositifs) ?? undefined;
  return (
    <li className="flex items-start gap-4 px-5 py-4 break-inside-avoid sm:px-6">
      <PastilleFinanceur financeur={financeurDeLigne(option.id, aides)} taille="petite" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Identite nom={option.nom} financeurNom={option.financeurNom} confidence={confidence} />
        <p className="mt-1.5 text-sm leading-snug text-texte-discret">{texteDonnees(option.raison)}</p>
      </div>
      {montant != null && montant > 0 ? (
        <Montant valeur={montant} />
      ) : (
        <p className="max-w-[7.5rem] shrink-0 text-right text-sm leading-snug text-texte-discret">
          {montant == null ? 'montant selon dossier' : 'aucun montant estimé'}
        </p>
      )}
    </li>
  );
}

/** Aides sans montant (montant selon dossier, services gratuits) : leur détail est dans la liste des aides. */
function LignesDAides({ aides }: { aides: AideEvaluee[] }) {
  return (
    <Lignes>
      {aides.map((a) => (
        <li key={a.id} className="flex items-start gap-4 px-5 py-4 break-inside-avoid sm:px-6">
          <PastilleFinanceur financeur={a.financeur} taille="petite" className="mt-0.5" />
          <Identite nom={a.nom} financeurNom={a.financeurNom} />
        </li>
      ))}
    </Lignes>
  );
}
