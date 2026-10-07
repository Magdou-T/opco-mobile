'use client';

import {
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TYPE_ALTERNANCE_LABELS,
} from '@opco/core';
import type {
  CodeRegion,
  ContractType,
  NiveauDiplome,
  StatutBeneficiaire,
  StatutDirigeant,
  TypeAlternance,
  WizardState,
} from '@opco/core';
import {
  ChampRegion,
  CheckboxRow,
  ChoiceButton,
  ChoiceGroup,
  NumberField,
  OuiNonChoix,
} from '@/components/ui/forms';
import { EnTeteEtape } from './EnTeteEtape';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

/** Titre, introduction et libellé de l'âge selon la personne concernée par le projet. */
const ENTETES: Record<StatutBeneficiaire, { titre: string; chapeau: string; age: string }> = {
  salarie: {
    titre: 'Le salarié concerné',
    chapeau: "Ces informations déterminent les aides ouvertes au salarié et à l'entreprise.",
    age: 'Âge du salarié',
  },
  demandeur_emploi: {
    titre: 'La personne à recruter',
    chapeau: "Les aides au recrutement dépendent de la situation du demandeur d'emploi.",
    age: 'Âge de la personne',
  },
  alternant: {
    titre: "L'alternant",
    chapeau: "Le type de contrat et l'âge conditionnent la plupart des aides à l'alternance.",
    age: "Âge de l'alternant",
  },
  dirigeant: {
    titre: 'Le dirigeant',
    chapeau: 'Le statut du dirigeant détermine son fonds de formation et ses avantages fiscaux.',
    age: 'Âge du dirigeant',
  },
};

/** Contrats proposés au salarié : l'alternance est un projet à part entière. */
const CONTRATS_SALARIE = (Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).filter(
  ([contrat]) => contrat !== 'alternance',
);

/**
 * Région de résidence (demandeur d'emploi, alternant) : les aides régionales dépendent de la région où vit la
 * personne, pas de celle de l'entreprise. Par défaut, celle de l'entreprise (le moteur fait de même).
 */
function RegionDeResidence({
  label,
  state,
  updateState,
}: {
  label: string;
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}) {
  return (
    <ChampRegion
      label={label}
      valeur={state.regionBeneficiaireCode ?? state.regionCode}
      onChange={(code: CodeRegion) => updateState({ regionBeneficiaireCode: code })}
      aide={state.regionCode ? `Par défaut, celle de l'entreprise (${REGIONS[state.regionCode]}).` : undefined}
    />
  );
}

/** Étape 3 : la personne concernée par le projet. Les questions et les champs obligatoires suivent le projet choisi. */
export function StepSituation({ state, updateState }: Props) {
  const projet = state.projetType ?? 'formation_salarie';
  const statut = STATUT_PAR_PROJET[projet];
  const entete = ENTETES[statut];
  const avecSoldeCpf = statut === 'salarie' || statut === 'dirigeant';

  return (
    <div className="space-y-8">
      <EnTeteEtape etape="situation" titre={entete.titre} chapeau={entete.chapeau} obligatoires />

      <div className="space-y-7">
        {statut === 'salarie' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTRATS_SALARIE.map(([contrat, libelle]) => (
                  <ChoiceButton
                    key={contrat}
                    label={libelle}
                    selected={state.contractType === contrat}
                    onClick={() => updateState({ contractType: contrat })}
                    compact
                  />
                ))}
              </div>
            </ChoiceGroup>
            <NumberField
              label="Ancienneté dans l'entreprise (en mois)"
              required={projet === 'reconversion_salarie'}
              facultatif={projet !== 'reconversion_salarie'}
              value={state.anciennete_mois}
              onChange={(anciennete_mois) => updateState({ anciennete_mois })}
              placeholder="Ex : 24"
            />
          </>
        )}

        {statut === 'demandeur_emploi' && (
          <>
            <OuiNonChoix
              label="Inscrit(e) à France Travail"
              value={state.inscritFranceTravail}
              onChange={(inscritFranceTravail) => updateState({ inscritFranceTravail })}
              required
            />
            <RegionDeResidence label="Région de résidence" state={state} updateState={updateState} />
          </>
        )}

        {statut === 'alternant' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(TYPE_ALTERNANCE_LABELS) as [TypeAlternance, string][]).map(([type, libelle]) => (
                  <ChoiceButton
                    key={type}
                    label={libelle}
                    selected={state.typeAlternance === type}
                    onClick={() => updateState({ typeAlternance: type, contractType: 'alternance' })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Actuellement inscrit(e) à France Travail"
              value={state.inscritFranceTravail}
              onChange={(inscritFranceTravail) => updateState({ inscritFranceTravail })}
              avecInconnu
            />
            <RegionDeResidence label="Région de résidence de l'alternant" state={state} updateState={updateState} />
          </>
        )}

        {statut === 'dirigeant' && (
          <>
            <ChoiceGroup label="Statut du dirigeant" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(STATUT_DIRIGEANT_LABELS) as [StatutDirigeant, string][]).map(([s, libelle]) => (
                  <ChoiceButton
                    key={s}
                    label={libelle}
                    selected={state.statutDirigeant === s}
                    onClick={() => updateState({ statutDirigeant: s })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Micro-entrepreneur"
              value={state.microEntrepreneur}
              onChange={(microEntrepreneur) => updateState({ microEntrepreneur })}
              avecInconnu
            />
          </>
        )}
      </div>

      <div className="space-y-7 border-t border-filet pt-8">
        <NumberField
          label={entete.age}
          required={statut === 'alternant'}
          facultatif={statut !== 'alternant'}
          value={state.ageBeneficiaire}
          onChange={(ageBeneficiaire) => updateState({ ageBeneficiaire })}
          min={14}
          max={99}
          placeholder="Ex : 19"
        />

        <ChoiceGroup label="Diplôme le plus élevé" facultatif>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(NIVEAU_DIPLOME_LABELS) as [NiveauDiplome, string][]).map(([niveau, libelle]) => (
              <ChoiceButton
                key={niveau}
                label={libelle}
                selected={state.niveauDiplome === niveau}
                // Choix facultatif : un second clic le retire.
                onClick={() => updateState({ niveauDiplome: state.niveauDiplome === niveau ? null : niveau })}
                compact
              />
            ))}
          </div>
        </ChoiceGroup>

        <CheckboxRow
          label="Reconnaissance de travailleur handicapé (RQTH ou équivalent)"
          description="Ouvre droit à des aides spécifiques (Agefiph, CPF majoré…)"
          checked={state.isHandicap}
          onToggle={(isHandicap) => updateState({ isHandicap })}
        />

        {avecSoldeCpf && (
          <NumberField
            label="Solde CPF (€)"
            facultatif
            decimal
            value={state.soldeCpf}
            onChange={(soldeCpf) => updateState({ soldeCpf })}
            placeholder="Ex : 1200"
            helper="Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant."
          />
        )}
      </div>
    </div>
  );
}
