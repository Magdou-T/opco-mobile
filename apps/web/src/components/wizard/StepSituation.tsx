'use client';

import { WizardState, ContractType, CompanySize, CONTRACT_TYPE_LABELS, COMPANY_SIZE_LABELS } from '@/lib/types';
import { getOpcoBySlug } from '../../../data/opcos';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

export function StepSituation({ state, updateState }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? getOpcoBySlug(opcoSlug) : null;
  const baremes = opco?.baremes_par_branche ?? [];
  const selectedBareme = baremes.find((b) => b.id === state.selectedBranche);

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

      {/* Accord de branche */}
      {opco && baremes.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-soft" htmlFor="branche-select">
            Votre accord de branche
          </label>
          <p className="text-xs text-ink-faint">
            {opco.name} applique des barèmes différents selon la convention collective.
            Sélectionnez la vôtre pour affiner l&apos;estimation ; laissez « Je ne sais pas »
            pour le barème générique.
          </p>
          <select
            id="branche-select"
            value={state.selectedBranche || ''}
            onChange={(e) => updateState({ selectedBranche: e.target.value || null })}
            className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
          >
            <option value="">Je ne sais pas / autre branche (barème générique)</option>
            {baremes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom}
              </option>
            ))}
          </select>
          {selectedBareme?.note && (
            <div className="rounded border border-marker bg-marker-soft px-3 py-2 text-xs leading-relaxed text-ink-soft">
              {selectedBareme.note}
            </div>
          )}
        </div>
      )}

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

      {/* Taille entreprise */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Taille de l&apos;entreprise <span className="text-alert">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(COMPANY_SIZE_LABELS) as [CompanySize, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateState({ companySize: key })}
              className={`p-3 rounded border-2 text-sm text-left transition-all ${
                state.companySize === key
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
