'use client';

import { WizardState, CONTRACT_TYPE_LABELS, COMPANY_SIZE_LABELS, TRAINING_TYPE_LABELS, TRAINING_MODE_LABELS, WizardStep } from '@/lib/types';
import { OPCO_LIST, getOpcoBySlug } from '../../../data/opcos';

interface Props {
  state: WizardState;
  onEdit: (step: WizardStep) => void;
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-rule rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-cobalt hover:text-navy font-medium"
        >
          Modifier
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink font-medium">{value || '-'}</dd>
    </>
  );
}

export function StepRecap({ state, onEdit }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? OPCO_LIST.find(o => o.slug === opcoSlug) : null;
  const fullOpco = opcoSlug ? getOpcoBySlug(opcoSlug) : null;
  const brancheNom = state.selectedBranche
    ? fullOpco?.baremes_par_branche?.find(b => b.id === state.selectedBranche)?.nom ?? null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">
          Récapitulatif
        </h2>
        <p className="text-ink-soft text-sm">
          Vérifiez vos informations avant de lancer le calcul du financement.
        </p>
      </div>

      {/* OPCO */}
      <Section title="OPCO" onEdit={() => onEdit('identification')}>
        <Item label="OPCO" value={opco?.name} />
        <Item label="Secteurs" value={opco?.secteurs} />
        {brancheNom && <Item label="Accord de branche" value={brancheNom} />}
        {state.detectedCompanyName && (
          <Item label="Entreprise" value={`${state.detectedCompanyName} (${state.sirenNumber})`} />
        )}
      </Section>

      {/* Situation pro */}
      <Section title="Situation professionnelle" onEdit={() => onEdit('situation')}>
        <Item label="Contrat" value={state.contractType ? CONTRACT_TYPE_LABELS[state.contractType] : null} />
        <Item label="Taille entreprise" value={state.companySize ? COMPANY_SIZE_LABELS[state.companySize] : null} />
        <Item label="Ancienneté" value={state.anciennete_mois ? `${state.anciennete_mois} mois` : null} />
        {state.isHandicap && <Item label="Handicap" value="Oui (RQTH)" />}
        {state.isReconversion && <Item label="Reconversion" value="Oui" />}
        {state.isSortieChomage && <Item label="Sortie chômage" value="Oui" />}
      </Section>

      {/* Formation */}
      <Section title="Formation" onEdit={() => onEdit('formation')}>
        <Item label="Formation" value={state.formationNom} />
        <Item label="Type" value={state.formationType ? TRAINING_TYPE_LABELS[state.formationType] : null} />
        <Item label="Mode" value={state.trainingMode ? TRAINING_MODE_LABELS[state.trainingMode] : null} />
        <Item label="Durée" value={state.durationHours ? `${state.durationHours}h` : null} />
        <Item label="Coût total" value={state.pedagogyCostTotal ? `${state.pedagogyCostTotal} €` : null} />
        <Item label="Coût/heure" value={state.pedagogyCostPerHour ? `${state.pedagogyCostPerHour} €/h` : null} />
        <Item label="Organisme" value={state.organismeFormation} />
      </Section>

      {/* Frais */}
      {(state.needsTransport || state.needsAccommodation || state.needsMeals) && (
        <Section title="Frais annexes" onEdit={() => onEdit('frais')}>
          {state.needsTransport && (
            <>
              <Item label="Transport" value={state.transportMode || 'Oui'} />
              {state.transportDistanceKm && <Item label="Distance" value={`${state.transportDistanceKm} km`} />}
            </>
          )}
          {state.needsAccommodation && (
            <>
              <Item label="Hébergement" value={`${state.accommodationNights} nuits`} />
              <Item label="Coût/nuit" value={state.accommodationCostPerNight ? `${state.accommodationCostPerNight} €` : null} />
            </>
          )}
          {state.needsMeals && (
            <Item label="Restauration" value={state.mealCostPerDay ? `${state.mealCostPerDay} €/jour` : 'Oui'} />
          )}
          <Item label="Jours de formation" value={state.trainingDays ? `${state.trainingDays} jours` : null} />
        </Section>
      )}
    </div>
  );
}
