'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import {
  CERTIFICATION_LABELS,
  COMPANY_SIZE_LABELS,
  CONTRACT_TYPE_LABELS,
  EMBEDDED_OPCO_LIST,
  ID_PROFIL_PRINCIPAL,
  NIVEAU_CERTIFICATION_LABELS,
  NIVEAU_DIPLOME_LABELS,
  PROJET_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  TYPE_ALTERNANCE_LABELS,
  getEmbeddedOpcoBySlug,
  nombreDePersonnes,
  profilsDuGroupe,
  resolveVarianteBranche,
  saisieDepuisMois,
} from '@opco/core';
import type { ChampsProfil, CodeRegion, WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { EtapeSite } from '@/lib/etapes';
import { formatEuro, nombreEtUnite } from '@/lib/format';
import { coutDuGroupe, ouvreBudgetPourLeGroupe } from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu } from '@/lib/parcours';
import { STATUT_DU_PROFIL } from '@/lib/profils';
import { numeroLisible } from '@/lib/recherche';
import { EnTeteEtape } from './EnTeteEtape';
import { ICONES_PROJET, TRANSPORT_LABELS } from './libelles';

interface Props {
  state: WizardState;
  onEdit: (step: EtapeSite) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » ou « Ne sait pas » : écrites telles quelles. */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  /** Les mêmes réponses pour chaque profil supplémentaire. */
  inconnuesProfils: InconnuesParProfil;
}

/** Ligne du récapitulatif : une valeur nulle s'affiche « Non renseigné ». */
type Ligne = [libelle: string, valeur: ReactNode | null | undefined];

/** Nombre et unité liés par une espace insécable (« 35 h », « 1 500 h », « 24 mois ») : `nombreEtUnite`, comme l'en-tête des résultats. */
const avecUnite = nombreEtUnite;
const pluriel = (n: number, un: string, plusieurs: string): string => avecUnite(n, n > 1 ? plusieurs : un);

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();

/** « Oui », « Non » ou « Je ne sais pas » (réponse retenue) ; null quand la question n'a pas de réponse. */
const reponseOuiNon =
  (inconnues: ReadonlySet<QuestionAvecInconnu>) =>
  (question: QuestionAvecInconnu, valeur: boolean | null): string | null =>
    valeur == null ? (inconnues.has(question) ? 'Je ne sais pas' : null) : valeur ? 'Oui' : 'Non';

/** Section du récapitulatif : en-tête iconifié, bouton « Modifier » qui rouvre l'étape, lignes libellé / valeur. */
function Section({
  titre,
  icone,
  onEdit,
  lignes,
}: {
  titre: string;
  icone: IconName;
  onEdit: () => void;
  lignes: Ligne[];
}) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} padding="none">
      <div className="flex items-center justify-between gap-4 border-b border-filet px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-turquoise-soft text-turquoise-deep"
          >
            <Icon name={icone} className="size-[18px]" />
          </span>
          <h3 id={id} className="text-lg leading-snug font-bold tracking-[-0.01em] text-texte">
            {titre}
          </h3>
        </div>
        <Button variant="ghost" icone="crayon" onClick={onEdit} aria-label={`Modifier la section ${titre}`}>
          Modifier
        </Button>
      </div>
      <dl className="divide-y divide-filet px-4 sm:px-6">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="grid gap-0.5 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6">
            <dt className="text-sm text-texte-doux">{libelle}</dt>
            <dd className="text-sm font-medium break-words text-texte">
              {valeur == null || valeur === '' ? (
                <span className="font-normal text-texte-discret">Non renseigné</span>
              ) : (
                valeur
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Réponses d'un profil, ligne par ligne, selon son statut. `inconnues` : les questions auxquelles le profil a répondu « Je
 * ne sais pas » ; `regionEntreprise` : région de résidence par défaut (celle de l'entreprise, comme le moteur).
 */
function lignesDuProfil(
  champs: ChampsProfil,
  inconnues: ReadonlySet<QuestionAvecInconnu>,
  regionEntreprise: CodeRegion | null,
): Ligne[] {
  const statut = STATUT_PAR_PROJET[champs.projetType ?? 'formation_salarie'];
  const ouiNon = reponseOuiNon(inconnues);
  const regionResidence: Ligne = [
    'Région de résidence',
    champs.regionBeneficiaireCode
      ? REGIONS[champs.regionBeneficiaireCode]
      : regionEntreprise
        ? `${REGIONS[regionEntreprise]} (celle de l'entreprise)`
        : null,
  ];
  const communes: Ligne[] = [
    ['Âge', champs.ageBeneficiaire != null ? pluriel(champs.ageBeneficiaire, 'an', 'ans') : null],
    ['Diplôme le plus élevé', champs.niveauDiplome ? NIVEAU_DIPLOME_LABELS[champs.niveauDiplome] : null],
    ['Reconnaissance de travailleur handicapé', champs.isHandicap ? 'Oui' : 'Non'],
  ];
  const soldeCpf: Ligne = ['Solde CPF', champs.soldeCpf != null ? formatEuro(champs.soldeCpf) : null];
  switch (statut) {
    case 'salarie':
      return [
        [
          'Contrat',
          champs.contractType && champs.contractType !== 'alternance' ? CONTRACT_TYPE_LABELS[champs.contractType] : null,
        ],
        ['Ancienneté', champs.anciennete_mois != null ? avecUnite(champs.anciennete_mois, 'mois') : null],
        ...communes,
        soldeCpf,
      ];
    case 'demandeur_emploi':
      return [
        ['Inscription à France Travail', ouiNon('inscritFranceTravail', champs.inscritFranceTravail)],
        regionResidence,
        ...communes,
      ];
    case 'alternant':
      return [
        ["Type de contrat d'alternance", champs.typeAlternance ? TYPE_ALTERNANCE_LABELS[champs.typeAlternance] : null],
        ['Inscription à France Travail', ouiNon('inscritFranceTravail', champs.inscritFranceTravail)],
        regionResidence,
        ...communes,
      ];
    case 'dirigeant':
      return [
        ['Statut du dirigeant', champs.statutDirigeant ? STATUT_DIRIGEANT_LABELS[champs.statutDirigeant] : null],
        ['Micro-entrepreneur', ouiNon('microEntrepreneur', champs.microEntrepreneur)],
        ...communes,
        soldeCpf,
      ];
  }
}

/**
 * Étape 6 : tout ce qui a été saisi, section par section, avant de lancer la recherche des financements. Une réponse
 * « Je ne sais pas » est écrite telle quelle ; « Non renseigné » reste réservé aux questions sans réponse. Un groupe de
 * plusieurs profils a une section « Participants » (le total) puis une section par profil ; le prix de la formation s'écrit
 * par personne et pour le groupe. Dès deux personnes, la section « Frais annexes » commence par « Montants saisis » : ceux
 * d'une personne, comptés pour chacune.
 */
export function StepRecap({ state, onEdit, reponsesInconnues, inconnuesProfils }: Props) {
  const projet = state.projetType ?? 'formation_salarie';
  const profils = profilsDuGroupe(state);
  const personnes = nombreDePersonnes(state);
  const groupe = personnes > 1;
  const ouiNon = reponseOuiNon(reponsesInconnues);
  /** Choix d'une liste dont l'option vide se lit « Ne sait pas ». */
  const choix = (question: QuestionAvecInconnu, libelle: string | null): string | null =>
    libelle ?? (reponsesInconnues.has(question) ? 'Ne sait pas' : null);
  const inconnuesDe = (id: string): ReadonlySet<QuestionAvecInconnu> =>
    id === ID_PROFIL_PRINCIPAL ? reponsesInconnues : (inconnuesProfils[id] ?? AUCUNE_REPONSE);

  // OPCO et barème de branche appliqué par le moteur : choix manuel, sinon variante qui couvre l'IDCC détecté, sinon
  // barème général (la ligne n'existe que pour un OPCO qui a des barèmes par branche).
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? EMBEDDED_OPCO_LIST.find((o) => o.slug === opcoSlug) : null;
  const opcoComplet = opcoSlug ? getEmbeddedOpcoBySlug(opcoSlug) : null;
  const variante = opcoComplet ? resolveVarianteBranche(opcoComplet, state) : null;
  const aDesVariantes = (opcoComplet?.variantes_branche?.length ?? 0) > 0;
  const brancheNom = variante
    ? variante.id === state.selectedBrancheId
      ? variante.branche_nom
      : `${variante.branche_nom} (détectée d'après l'IDCC ${state.detectedIdcc})`
    : 'Barème général';

  const entreprise: Ligne[] = [
    ...(state.detectedCompanyName && state.sirenNumber
      ? ([['Entreprise', `${state.detectedCompanyName} (SIREN ${numeroLisible(state.sirenNumber)})`]] as Ligne[])
      : []),
    ['OPCO', opco ? `${opco.name}${state.selectedOpcoSlug ? ' (choisi manuellement)' : ''}` : null],
    ...(aDesVariantes ? ([['Accord de branche', brancheNom]] as Ligne[]) : []),
    ['Région', state.regionCode ? REGIONS[state.regionCode] : null],
    [
      'Taille',
      state.companySize
        ? `${COMPANY_SIZE_LABELS[state.companySize]}${state.effectif != null ? " (déduite de l'effectif)" : ''}`
        : null,
    ],
    ['Effectif exact', state.effectif != null ? pluriel(state.effectif, 'salarié', 'salariés') : null],
    ...(ouvreBudgetPourLeGroupe(state)
      ? ([
          ['Budget déjà consommé', state.budgetDejaConsomme != null ? formatEuro(state.budgetDejaConsomme) : null],
        ] as Ligne[])
      : []),
  ];

  // Une seule personne ou un seul profil : la section « Participants » porte les réponses. Plusieurs profils : le total dans
  // « Participants », puis une section par profil (nombre de personnes, statut, réponses).
  const sectionsDesPersonnes: { titre: string; lignes: Ligne[] }[] =
    profils.length === 1
      ? [
          {
            titre: 'Participants',
            lignes: [
              ...(groupe ? ([['Personnes', pluriel(personnes, 'personne', 'personnes')]] as Ligne[]) : []),
              ...lignesDuProfil(profils[0].champs, inconnuesDe(profils[0].id), state.regionCode),
            ],
          },
        ]
      : [
          {
            titre: 'Participants',
            lignes: [
              ['Personnes', `${pluriel(personnes, 'personne', 'personnes')} · ${pluriel(profils.length, 'profil', 'profils')}`],
            ],
          },
          ...profils.map((p, i) => ({
            titre: `Profil ${i + 1}`,
            lignes: [
              ['Personnes', pluriel(p.nombre, 'personne', 'personnes')],
              ['Statut', STATUT_DU_PROFIL[p.champs.projetType ?? 'formation_salarie']],
              ...lignesDuProfil(p.champs, inconnuesDe(p.id), state.regionCode),
            ] as Ligne[],
          })),
        ];

  const coutGroupe = coutDuGroupe(state);
  const formation: Ligne[] = [
    // « Intitulé » : la ligne « Formation » d'une section Formation se lisait comme une formation absente.
    ['Intitulé', state.formationNom],
    ['Type', state.formationType ? TRAINING_TYPE_LABELS[state.formationType] : null],
    [
      'Certification visée',
      choix('certificationLevel', state.certificationLevel ? CERTIFICATION_LABELS[state.certificationLevel] : null),
    ],
    [
      'Niveau visé',
      choix(
        'niveauFormationVise',
        state.niveauFormationVise ? NIVEAU_CERTIFICATION_LABELS[state.niveauFormationVise] : null,
      ),
    ],
    ['Éligible au CPF', ouiNon('eligibleCpf', state.eligibleCpf)],
    ['Mode', state.trainingMode ? TRAINING_MODE_LABELS[state.trainingMode] : null],
    ['Durée', state.durationHours ? avecUnite(state.durationHours, 'h') : null],
    ...(groupe
      ? ([
          ['Coût total HT par personne', state.pedagogyCostTotal ? formatEuro(state.pedagogyCostTotal) : null],
          ['Coût total HT pour le groupe', coutGroupe ? formatEuro(coutGroupe) : null],
        ] as Ligne[])
      : ([['Coût total HT', state.pedagogyCostTotal ? formatEuro(state.pedagogyCostTotal) : null]] as Ligne[])),
    [
      groupe ? 'Coût horaire par personne' : 'Coût horaire',
      state.pedagogyCostPerHour ? `${formatEuro(state.pedagogyCostPerHour)}/h` : null,
    ],
    ['Début prévu', saisieDepuisMois(state.dateDebutFormation) || null],
    ['Organisme', state.organismeFormation],
    ['Organisme certifié Qualiopi', ouiNon('organismeQualiopi', state.organismeQualiopi)],
  ];

  const joursEstimes = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;
  const avecFrais = state.needsTransport || state.needsAccommodation || state.needsMeals;
  const frais: Ligne[] = [
    // Un groupe : les frais saisis sont ceux d'une personne, le moteur les compte pour chacune (étape Frais).
    ...(groupe
      ? ([['Montants saisis', `Pour une personne, comptés pour chacune des ${avecUnite(personnes, 'personnes')}`]] as Ligne[])
      : []),
    ...(state.needsTransport
      ? ([
          ['Transport', state.transportMode ? TRANSPORT_LABELS[state.transportMode] : 'Oui'],
          ['Distance', state.transportDistanceKm != null ? avecUnite(state.transportDistanceKm, 'km') : null],
        ] as Ligne[])
      : []),
    ...(state.needsAccommodation
      ? ([
          ['Hébergement', state.accommodationNights ? pluriel(state.accommodationNights, 'nuit', 'nuits') : 'Oui'],
          ['Coût par nuit', state.accommodationCostPerNight != null ? formatEuro(state.accommodationCostPerNight) : null],
        ] as Ligne[])
      : []),
    ...(state.needsMeals
      ? ([['Restauration', state.mealCostPerDay != null ? `${formatEuro(state.mealCostPerDay)} par jour` : 'Oui']] as Ligne[])
      : []),
    [
      'Jours de formation',
      state.trainingDays
        ? pluriel(state.trainingDays, 'jour', 'jours')
        : joursEstimes > 0
          ? `${pluriel(joursEstimes, 'jour', 'jours')} (estimation, 7${INSECABLE}heures par jour)`
          : null,
    ],
  ];

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="recap"
        titre="Récapitulatif"
        chapeau="Vérifiez vos informations avant de lancer la recherche de financements."
      />

      <div className="space-y-4">
        {/* « Objectif » plutôt que « Projet » : la ligne répétait le titre de la section. */}
        <Section
          titre="Projet"
          icone={ICONES_PROJET[projet]}
          onEdit={() => onEdit('projet')}
          lignes={[['Objectif', state.projetType ? PROJET_LABELS[state.projetType].label : null]]}
        />
        <Section titre="Entreprise" icone="batiment" onEdit={() => onEdit('identification')} lignes={entreprise} />
        {sectionsDesPersonnes.map((s) => (
          <Section key={s.titre} titre={s.titre} icone="personne" onEdit={() => onEdit('situation')} lignes={s.lignes} />
        ))}
        <Section titre="Formation" icone="livre" onEdit={() => onEdit('formation')} lignes={formation} />
        {avecFrais && <Section titre="Frais annexes" icone="euro" onEdit={() => onEdit('frais')} lignes={frais} />}
      </div>
    </div>
  );
}
