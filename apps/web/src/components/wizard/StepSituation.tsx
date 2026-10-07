'use client';

import { CONTRACT_TYPE_LABELS } from '@opco/core';
import type { ContractType, WizardState } from '@opco/core';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

export function StepSituation({ state, updateState }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">
          Votre situation professionnelle
        </h2>
        <p className="text-ink-soft text-sm">
          Ces informations déterminent les plafonds et critères de financement applicables.
        </p>
      </div>

      {/* Type de contrat */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Type de contrat <span className="text-alert">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateState({ contractType: key })}
              className={`p-3 rounded border-2 text-sm text-left transition-all ${
                state.contractType === key
                  ? 'border-cobalt bg-cobalt-soft text-navy font-medium'
                  : 'border-rule hover:border-ink-faint text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ancienneté */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Ancienneté dans l&apos;entreprise (en mois)
        </label>
        <input
          type="number"
          min="0"
          value={state.anciennete_mois ?? ''}
          onChange={(e) => updateState({ anciennete_mois: e.target.value ? parseInt(e.target.value) : null })}
          placeholder="Ex: 24"
          className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
        />
      </div>

      {/* Situations particulières */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-ink-soft">
          Situations particulières (optionnel)
        </label>
        <div className="space-y-2">
          {[
            { key: 'isHandicap' as const, label: 'Situation de handicap (RQTH)', desc: 'Peut ouvrir droit à des financements complémentaires' },
            { key: 'isReconversion' as const, label: 'Reconversion professionnelle', desc: 'Projets de transition professionnelle' },
            { key: 'isSortieChomage' as const, label: 'Sortie de chômage', desc: 'Reprise d\'emploi récente' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 p-3 rounded border border-rule hover:bg-paper-deep cursor-pointer">
              <input
                type="checkbox"
                checked={state[key]}
                onChange={(e) => updateState({ [key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-rule text-cobalt focus:ring-cobalt"
              />
              <div>
                <div className="text-sm font-medium text-ink">{label}</div>
                <div className="text-xs text-ink-faint">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
