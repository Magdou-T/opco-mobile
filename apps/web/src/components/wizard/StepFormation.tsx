'use client';

import { useState } from 'react';
import {
  CERTIFICATION_LABELS,
  NIVEAU_CERTIFICATION_LABELS,
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  getEmbeddedOpcoBySlug,
  moisDepuisSaisie,
  saisieDepuisMois,
} from '@opco/core';
import type { CertificationType, NiveauCertification, TrainingMode, TrainingType, WizardState } from '@opco/core';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { ChoiceButton, ChoiceGroup, NumberField, OuiNonChoix, SelectField, TextField } from '@/components/ui/forms';
import { ouvreBudgetOpco } from '@/lib/entreprise';
import { de, formatEuro } from '@/lib/format';
import {
  depassePlafondHoraire,
  erreurDuMoisDeDebut,
  etatDepuisModeFormation,
  plafondHoraireIndicatif,
} from '@/lib/parcours';
import type { QuestionAvecInconnu, Repondre } from '@/lib/parcours';
import { EnTeteEtape } from './EnTeteEtape';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  updateFormationCosts: (total: number | null, hours: number | null) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » ou « Ne sait pas » (la valeur reste null). */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  repondre: Repondre;
}

const parHeure = (montant: number): string => `${formatEuro(montant)}/h`;

const OPTIONS_CERTIFICATION = [
  { valeur: '', libelle: 'Ne sait pas' },
  ...(Object.entries(CERTIFICATION_LABELS) as [CertificationType, string][]).map(([valeur, libelle]) => ({
    valeur,
    libelle,
  })),
];

const OPTIONS_NIVEAU = [
  ...Object.entries(NIVEAU_CERTIFICATION_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })),
  { valeur: '', libelle: 'Ne sait pas' },
];

/** Étape 4 : la formation. Type, mode, durée et coût sont obligatoires ; le reste affine la recherche des aides. */
export function StepFormation({ state, updateState, updateFormationCosts, reponsesInconnues, repondre }: Props) {
  // Saisie du mois de début gardée telle quelle : l'état ne reçoit qu'un mois valide (AAAA-MM), sinon null. Comme les
  // autres champs, une saisie refusée (« 13/2026 », « 2027-03 ») devient une erreur quand on quitte le champ.
  const [saisieDebut, setSaisieDebut] = useState(() => saisieDepuisMois(state.dateDebutFormation));
  const [debutQuitte, setDebutQuitte] = useState(false);
  const erreurDebut = debutQuitte ? erreurDuMoisDeDebut(saisieDebut) : null;

  // Plafond horaire indicatif du barème appliqué, pour les projets qui passent par le budget de l'OPCO.
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const plafond = ouvreBudgetOpco(state.projetType) ? plafondHoraireIndicatif(opco, state) : null;
  const coutHoraire = state.pedagogyCostPerHour != null && state.pedagogyCostPerHour > 0 ? state.pedagogyCostPerHour : null;
  const enveloppeEpuisee = plafond === 0;
  const depasse = depassePlafondHoraire(coutHoraire, plafond);

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="formation"
        titre="La formation"
        chapeau="Décrivez la formation à financer. Son type et son coût horaire déterminent les plafonds et les aides qui s'appliquent."
        obligatoires
      />

      <div className="space-y-7">
        <TextField
          label="Nom de la formation"
          facultatif
          value={state.formationNom ?? ''}
          onChange={(formationNom) => updateState({ formationNom: formationNom || null })}
          placeholder="Ex&nbsp;: Développeur web full stack"
        />

        <ChoiceGroup
          label="Type de formation"
          required
          aide="Il fixe le plafond horaire de l'OPCO et les aides propres à un type. Une aide propre à la VAE ne s'applique qu'aux parcours de VAE."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.entries(TRAINING_TYPE_LABELS) as [TrainingType, string][]).map(([type, libelle]) => (
              <ChoiceButton
                key={type}
                label={libelle}
                selected={state.formationType === type}
                onClick={() => updateState({ formationType: type })}
                compact
              />
            ))}
          </div>
        </ChoiceGroup>

        <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
          {/* « Ne sait pas » (valeur vide) est retenu comme réponse : le récapitulatif l'écrit au lieu de « Non renseigné ». */}
          <SelectField
            label="Certification visée"
            value={state.certificationLevel ?? ''}
            onChange={(valeur) => repondre('certificationLevel', (valeur || null) as CertificationType | null)}
            options={OPTIONS_CERTIFICATION}
          />
          <SelectField
            label="Niveau de la certification visée"
            value={state.niveauFormationVise == null ? '' : String(state.niveauFormationVise)}
            onChange={(valeur) =>
              repondre('niveauFormationVise', valeur ? (Number(valeur) as NiveauCertification) : null)
            }
            options={OPTIONS_NIVEAU}
          />
        </div>

        <OuiNonChoix
          label="Formation éligible au CPF"
          value={state.eligibleCpf}
          inconnu={reponsesInconnues.has('eligibleCpf')}
          onChange={(eligibleCpf) => repondre('eligibleCpf', eligibleCpf)}
          avecInconnu
        />
      </div>

      <div className="space-y-7 border-t border-filet pt-8">
        <ChoiceGroup
          label="Mode de formation"
          required
          aide={
            state.trainingMode === 'distance' ? (
              <>Formation entièrement à distance&nbsp;: l&apos;étape des frais de déplacement est sautée.</>
            ) : undefined
          }
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.entries(TRAINING_MODE_LABELS) as [TrainingMode, string][]).map(([mode, libelle]) => (
              <ChoiceButton
                key={mode}
                label={libelle}
                selected={state.trainingMode === mode}
                onClick={() => updateState(etatDepuisModeFormation(mode))}
                compact
              />
            ))}
          </div>
        </ChoiceGroup>

        <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
          <NumberField
            label="Durée (en heures)"
            required
            value={state.durationHours}
            onChange={(heures) => updateFormationCosts(state.pedagogyCostTotal, heures)}
            min={1}
            placeholder="Ex&nbsp;: 140"
            largeur="pleine"
          />
          <NumberField
            label="Coût total HT (€)"
            required
            decimal
            euros
            value={state.pedagogyCostTotal}
            onChange={(total) => updateFormationCosts(total, state.durationHours)}
            min={1}
            placeholder="Ex&nbsp;: 5600"
            largeur="pleine"
          />
        </div>

        {coutHoraire != null && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-champ border border-filet bg-lin-soft px-4 py-3">
              <p className="flex items-center gap-2.5 text-sm text-texte-doux">
                <Icon name="calculatrice" className="size-5 shrink-0 text-turquoise-deep" />
                <span>
                  Coût horaire calculé&nbsp;:{' '}
                  <span className="amount text-lg text-texte">{parHeure(coutHoraire)}</span>
                </span>
              </p>
              {plafond != null && plafond > 0 && opco && (
                <p className="text-sm text-texte-doux">
                  Plafond indicatif {de(opco.name)}&nbsp;:{' '}
                  <span className="font-semibold text-texte">{parHeure(plafond)}</span>
                </p>
              )}
            </div>
            {depasse && opco && plafond != null && (
              <Callout tone="avertissement" titre="Coût horaire au-dessus du plafond indicatif">
                {`Le coût horaire (${parHeure(coutHoraire)}) dépasse le plafond indicatif ${de(opco.name)} (${parHeure(plafond)}). Le surplus sera à votre charge.`}
              </Callout>
            )}
            {enveloppeEpuisee && opco && (
              <Callout tone="avertissement" titre="Enveloppe épuisée dans le barème appliqué">
                Le barème appliqué {de(opco.name)}{' '}affiche un plafond de 0&nbsp;€/h&nbsp;: l&apos;enveloppe est épuisée.
                Sur ce barème, le coût de la formation resterait à votre charge.
              </Callout>
            )}
          </div>
        )}
      </div>

      <div className="space-y-7 border-t border-filet pt-8">
        <TextField
          label="Mois de début prévu (MM/AAAA)"
          value={saisieDebut}
          onChange={(saisie) => {
            setSaisieDebut(saisie);
            updateState({ dateDebutFormation: moisDepuisSaisie(saisie) });
          }}
          onBlur={() => setDebutQuitte(true)}
          placeholder="Ex&nbsp;: 03/2027"
          autoComplete="off"
          largeur="courte"
          helper={<>Facultatif&nbsp;: sert à vérifier les dates de validité des aides.</>}
          erreur={erreurDebut ?? undefined}
        />

        <OuiNonChoix
          label="Organisme de formation certifié Qualiopi"
          value={state.organismeQualiopi}
          inconnu={reponsesInconnues.has('organismeQualiopi')}
          onChange={(organismeQualiopi) => repondre('organismeQualiopi', organismeQualiopi)}
          avecInconnu
        />

        <TextField
          label="Organisme de formation"
          facultatif
          value={state.organismeFormation ?? ''}
          onChange={(organismeFormation) => updateState({ organismeFormation: organismeFormation || null })}
          placeholder="Ex&nbsp;: AFPA, CNAM, organisme privé"
        />
      </div>
    </div>
  );
}
