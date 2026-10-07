import type { CSSProperties, ReactNode } from 'react';
import type { AideEvaluee, Confidence, LignePlan, OptionPlan, PlanFinancement } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatEuro, texteDonnees, typo } from '@/lib/format';
import {
  cartesDuPlan,
  descriptionBarre,
  etatEnTete,
  financeurDeLigne,
  libellePart,
  partFinancee,
  partsBarre,
  rappelsAucunFinancement,
} from '@/lib/resultats';
import type { CartePlan, EtatEnTete, PartBarre } from '@/lib/resultats';
import { BORD_SEGMENT, COULEURS_FAMILLE, COULEURS_IMPRIMEES, PastilleFinanceur, SEGMENT_RESTE } from './Financeur';

/**
 * Plan de financement : bandeau de synthèse (coût, financé, reste à charge, barre empilée par famille de financeurs),
 * puis une carte par catégorie (financement de la formation en pile, options, aides à l'employeur, revenus et aides à la
 * personne, avantages fiscaux et sociaux, montant selon dossier, services gratuits). Chaque montant est celui du moteur,
 * arrondi à l'affichage seulement ; une carte vide n'est pas rendue. Règles de présentation : `lib/resultats.ts`.
 */
/** L'OPCO signale épuisée l'enveloppe de branches dont le plan compte le plan de développement des compétences. */
export interface FondsEpuises {
  opco: string;
  branches: string[];
}

export function PlanFinancementCard({
  plan,
  aides,
  fondsEpuises = null,
  apresBandeau,
  onModifierFormation,
}: {
  plan: PlanFinancement;
  /** Aides évaluées : elles donnent le financeur (donc la couleur) de chaque ligne du plan. */
  aides: readonly AideEvaluee[];
  /** Fonds épuisés signalés par l'OPCO (`fondsEpuisesSurLePlan`) : dit à côté du montant financé. */
  fondsEpuises?: FondsEpuises | null;
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
        onModifierFormation={onModifierFormation}
      />
      {apresBandeau}
      {cartesDuPlan(plan).map((carte, i) => (
        <CarteDuPlan key={carte} carte={carte} plan={plan} aides={aides} style={delai(120 + i * 70)} />
      ))}
    </div>
  );
}

const delai = (ms: number) => ({ '--delai': `${ms}ms` }) as CSSProperties;

// --- Bandeau de synthèse ------------------------------------------------------------------------------------------

function BandeauSynthese({
  plan,
  aides,
  etat,
  fondsEpuises,
  onModifierFormation,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  etat: EtatEnTete;
  fondsEpuises: FondsEpuises | null;
  onModifierFormation?: () => void;
}) {
  return (
    <div className="apparition overflow-hidden rounded-panneau border border-filet bg-white shadow-douce">
      {/* Les trois soulignés du slogan de marque, en filet (comme le pied de page) */}
      <div aria-hidden="true" className="decor flex h-1.5">
        <span className="flex-1 bg-turquoise" />
        <span className="flex-1 bg-or" />
        <span className="flex-1 bg-orange" />
      </div>
      <div className="p-5 sm:p-8">
        {etat === 'cout_inconnu' && <CoutInconnu onModifierFormation={onModifierFormation} />}
        {etat === 'aucun_financement_chiffre' && <AucunFinancementChiffre plan={plan} />}
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
 * dit pourquoi, et des liens mènent aux cartes qui portent les aides identifiées.
 */
function AucunFinancementChiffre({ plan }: { plan: PlanFinancement }) {
  const rappels = rappelsAucunFinancement(plan);
  const optionsChiffrees = plan.options.some((o) => o.montantEstime != null && o.montantEstime > 0);
  return (
    <div>
      <dl className="grid sm:grid-cols-3">
        <Chiffre libelle="Coût de la formation" valeur={formatEuro(plan.coutFormation)} />
      </dl>
      <Callout tone="info" className="mt-5">
        {optionsChiffrees ? (
          <>
            Aucun financement cumulable n&apos;est chiffré pour cette formation&nbsp;: les options au choix ont un montant,
            à comparer, et les autres financeurs fixent le montant après étude du dossier.
          </>
        ) : (
          <>
            Aucun financement de la formation n&apos;est chiffrable à ce stade&nbsp;: les financeurs fixent le montant
            après étude du dossier. Voici les aides identifiées.
          </>
        )}
      </Callout>
      {rappels.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 print:hidden">
          {rappels.map((r) => (
            <li key={r.carte}>
              <a
                href={`#carte-${r.carte}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-orange/30 bg-orange-soft px-4 text-sm font-semibold text-orange-deep transition-[border-color] hover:border-orange-deep lg:min-h-9"
              >
                {r.libelle}
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
        <Chiffre
          libelle="Reste à charge"
          valeur={formatEuro(plan.resteACharge)}
          couleur="text-orange-deep"
          detail={plan.resteACharge > 0 ? undefined : 'La formation est entièrement couverte.'}
        />
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

/**
 * Barre horizontale empilée : une part par famille de financeurs puis le reste à charge (hachures). Jamais seule porteuse
 * d'information : son nom accessible (role="img") et la légende écrite donnent chaque part avec son libellé ; les
 * largeurs suivent les montants (au moins 6 px pour une part minuscule).
 */
function BarreEmpilee({ parts, cout }: { parts: PartBarre[]; cout: number }) {
  if (parts.length === 0) return null;
  return (
    <figure className={cx('mt-7', COULEURS_IMPRIMEES)}>
      <div role="img" aria-label={descriptionBarre(parts, cout)} className="devoilement flex h-4 gap-0.5 sm:h-5">
        {parts.map((p) => (
          <span
            key={p.cle}
            className={cx('h-full min-w-1.5 first:rounded-l-full last:rounded-r-full', classeDePart(p))}
            style={{ flexGrow: Math.round(p.montant * 100), flexBasis: 0 }}
          />
        ))}
      </div>
      <figcaption className="mt-3.5">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {parts.map((p) => (
            <li key={p.cle} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cx('size-3 shrink-0 rounded-[0.25rem]', classeDePart(p))} />
              <span className="font-semibold text-texte">{typo(p.libelle)}</span>
              <span className="text-texte-doux tabular-nums">{libellePart(p)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

const classeDePart = (p: PartBarre): string =>
  p.cle === 'reste' ? SEGMENT_RESTE : cx(COULEURS_FAMILLE[p.cle].fond, BORD_SEGMENT);

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
  style,
}: {
  carte: CartePlan;
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
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
        <ContenuDeCarte carte={carte} plan={plan} aides={aides} />
      </Card>
    </section>
  );
}

function ContenuDeCarte({ carte, plan, aides }: { carte: CartePlan; plan: PlanFinancement; aides: readonly AideEvaluee[] }) {
  switch (carte) {
    case 'financements':
      return <PileDesFinancements plan={plan} aides={aides} />;
    case 'options':
      return (
        <Lignes>
          {plan.options.map((o) => (
            <LigneOption key={o.id} option={o} aides={aides} />
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

function Lignes({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-filet border-t border-filet">{children}</ul>;
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
function PileDesFinancements({ plan, aides }: { plan: PlanFinancement; aides: readonly AideEvaluee[] }) {
  const plusieurs = plan.financements.length > 1;
  return (
    <div className="border-t border-filet px-5 py-5 sm:px-6">
      <ol>
        {plan.financements.map((l) => (
          <li key={l.id} className={cx('relative flex items-start gap-4 break-inside-avoid', plusieurs && 'pb-6')}>
            {plusieurs && (
              <span
                aria-hidden="true"
                className="absolute top-12 bottom-0 left-5 w-0.5 -translate-x-1/2 rounded-full bg-filet"
              />
            )}
            <PastilleFinanceur financeur={financeurDeLigne(l.id, aides)} />
            <Identite nom={l.nom} financeurNom={l.financeurNom} confidence={l.confidence} />
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
 * Option au choix : montant (ou « montant selon dossier »), financeur et raison. La raison « Au choix avec « X » » nomme
 * une aide qui peut ne figurer dans aucune liste (coût déjà couvert, solde CPF épuisé) : texte simple, sans lien.
 */
function LigneOption({ option, aides }: { option: OptionPlan; aides: readonly AideEvaluee[] }) {
  const montant = option.montantEstime;
  return (
    <li className="flex items-start gap-4 px-5 py-4 break-inside-avoid sm:px-6">
      <PastilleFinanceur financeur={financeurDeLigne(option.id, aides)} taille="petite" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Identite nom={option.nom} financeurNom={option.financeurNom} />
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
