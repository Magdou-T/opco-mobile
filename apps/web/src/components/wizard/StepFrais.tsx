'use client';

import { WizardState, TransportMode } from '@/lib/types';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

export function StepFrais({ state, updateState }: Props) {
  // Auto-calculate training days from hours (7h/day standard)
  const estimatedDays = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">
          Frais annexes
        </h2>
        <p className="text-ink-soft text-sm">
          Si la formation nécessite un déplacement, indiquez vos frais prévisionnels.
          Certains OPCO prennent en charge tout ou partie de ces frais.
        </p>
      </div>

      {/* Training days */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Nombre de jours de formation
        </label>
        <input
          type="number"
          min="1"
          value={state.trainingDays ?? (estimatedDays || '')}
          onChange={(e) => updateState({ trainingDays: e.target.value ? parseInt(e.target.value) : null })}
          placeholder={`Estimation : ${estimatedDays} jours (base 7h/jour)`}
          className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
        />
        {!state.trainingDays && estimatedDays > 0 && (
          <p className="text-xs text-ink-faint">
            Estimation automatique : {estimatedDays} jours (base 7h/jour). Modifiable.
          </p>
        )}
      </div>

      {/* Transport */}
      <div className="space-y-3 p-4 border border-rule rounded">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.needsTransport}
            onChange={(e) => updateState({ needsTransport: e.target.checked })}
            className="h-4 w-4 rounded border-rule text-cobalt focus:ring-cobalt"
          />
          <span className="text-sm font-medium text-ink">
            J&apos;ai besoin d&apos;un déplacement
          </span>
        </label>

        {state.needsTransport && (
          <div className="ml-7 space-y-3">
            <div className="space-y-2">
              <label className="block text-sm text-ink-soft">Mode de transport</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['train', 'Train'],
                  ['avion', 'Avion'],
                  ['voiture', 'Voiture'],
                  ['autre', 'Autre'],
                ] as [TransportMode, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateState({ transportMode: key })}
                    className={`p-2 rounded border text-xs text-center transition-all ${
                      state.transportMode === key
                        ? 'border-cobalt bg-cobalt-soft text-navy font-medium'
                        : 'border-rule hover:border-ink-faint text-ink-soft'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Distance estimée (km)</label>
              <input
                type="number"
                min="0"
                value={state.transportDistanceKm ?? ''}
                onChange={(e) => updateState({ transportDistanceKm: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Ex: 250"
                className="w-full rounded border border-rule bg-white px-4 py-2 text-sm text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
              />
            </div>
          </div>
        )}
      </div>

      {/* Hébergement */}
      <div className="space-y-3 p-4 border border-rule rounded">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.needsAccommodation}
            onChange={(e) => updateState({ needsAccommodation: e.target.checked })}
            className="h-4 w-4 rounded border-rule text-cobalt focus:ring-cobalt"
          />
          <span className="text-sm font-medium text-ink">
            J&apos;ai besoin d&apos;un hébergement
          </span>
        </label>

        {state.needsAccommodation && (
          <div className="ml-7 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Nombre de nuits</label>
              <input
                type="number"
                min="1"
                value={state.accommodationNights ?? ''}
                onChange={(e) => updateState({ accommodationNights: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Ex: 10"
                className="w-full rounded border border-rule bg-white px-4 py-2 text-sm text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Coût par nuit (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={state.accommodationCostPerNight ?? ''}
                onChange={(e) => updateState({ accommodationCostPerNight: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Ex: 80"
                className="w-full rounded border border-rule bg-white px-4 py-2 text-sm text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
              />
            </div>
          </div>
        )}
      </div>

      {/* Restauration */}
      <div className="space-y-3 p-4 border border-rule rounded">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.needsMeals}
            onChange={(e) => updateState({ needsMeals: e.target.checked })}
            className="h-4 w-4 rounded border-rule text-cobalt focus:ring-cobalt"
          />
          <span className="text-sm font-medium text-ink">
            Frais de restauration
          </span>
        </label>

        {state.needsMeals && (
          <div className="ml-7">
            <label className="block text-sm text-ink-soft mb-1">Coût moyen par jour (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={state.mealCostPerDay ?? ''}
              onChange={(e) => updateState({ mealCostPerDay: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Ex: 15"
              className="w-full rounded border border-rule bg-white px-4 py-2 text-sm text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
            />
          </div>
        )}
      </div>
    </div>
  );
}
