'use client';

import {
  CONTRACT_TYPE_LABELS,
  COMPANY_SIZE_LABELS,
  REGIONS,
  TRAINING_TYPE_LABELS,
  TRAINING_MODE_LABELS,
  EMBEDDED_OPCO_LIST,
  getEmbeddedOpcoBySlug,
  resolveVarianteBranche,
} from '@opco/core';
import type { WizardState } from '@opco/core';
import type { EtapeSite } from '@/lib/etapes';
import { ouvreBudgetOpco } from '@/lib/entreprise';
import { formatEuro } from '@/lib/format';

interface Props {
  state: WizardState;
  onEdit: (step: EtapeSite) => void;
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-rule rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Modifier la section ${title}`}
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
  const opco = opcoSlug ? EMBEDDED_OPCO_LIST.find(o => o.slug === opcoSlug) : null;
  const fullOpco = opcoSlug ? getEmbeddedOpcoBySlug(opcoSlug) : null;
  // Barème de branche appliqué par le moteur : choix manuel, sinon variante qui couvre l'IDCC détecté, sinon barème général
  // (la ligne n'existe que pour un OPCO qui a des barèmes par branche).
  const variante = fullOpco ? resolveVarianteBranche(fullOpco, state) : null;
  const aDesVariantes = (fullOpco?.variantes_branche?.length ?? 0) > 0;
  const brancheNom = !aDesVariantes
    ? null
    : variante
      ? variante.id === state.selectedBrancheId
        ? variante.branche_nom
        : `${variante.branche_nom} (détecté d'après l'IDCC ${state.detectedIdcc})`
      : 'Barème général';

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

      {/* Entreprise */}
      <Section title="Entreprise" onEdit={() => onEdit('identification')}>
        {state.detectedCompanyName && (
          <Item label="Entreprise" value={`${state.detectedCompanyName} (SIREN ${state.sirenNumber})`} />
        )}
        <Item label="OPCO" value={opco?.name} />
        {brancheNom && <Item label="Accord de branche" value={brancheNom} />}
        <Item label="Région" value={state.regionCode ? REGIONS[state.regionCode] : null} />
        <Item label="Taille" value={state.companySize ? COMPANY_SIZE_LABELS[state.companySize] : null} />
        {state.effectif != null && (
          <Item label="Effectif exact" value={`${state.effectif} ${state.effectif > 1 ? 'salariés' : 'salarié'}`} />
        )}
        {ouvreBudgetOpco(state.projetType) && state.budgetDejaConsomme != null && (
          <Item label="Budget déjà consommé" value={formatEuro(state.budgetDejaConsomme)} />
        )}
      </Section>

      {/* Bénéficiaire */}
      <Section title="Bénéficiaire" onEdit={() => onEdit('situation')}>
        <Item label="Contrat" value={state.contractType ? CONTRACT_TYPE_LABELS[state.contractType] : null} />
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
