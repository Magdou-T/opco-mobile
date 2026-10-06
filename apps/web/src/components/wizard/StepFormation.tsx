'use client';

import { WizardState, TrainingType, TrainingMode, CertificationType, TRAINING_TYPE_LABELS, TRAINING_MODE_LABELS } from '@/lib/types';
import { getOpcoBySlug } from '../../../data/opcos';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  updateFormationCosts: (total: number | null, hours: number | null) => void;
}

export function StepFormation({ state, updateState, updateFormationCosts }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? getOpcoBySlug(opcoSlug) : null;

  // Alert if cost/h exceeds OPCO ceiling
  const ceilingWarning = (() => {
    if (!opco || !state.pedagogyCostPerHour) return null;
    const ceiling = opco.cout_horaire_inter?.value || opco.cout_horaire_metier?.value;
    if (ceiling && state.pedagogyCostPerHour > ceiling) {
      return `Le coût horaire (${state.pedagogyCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). Le surplus sera à votre charge.`;
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">
          Formation souhaitée
        </h2>
        <p className="text-ink-soft text-sm">
          Décrivez la formation pour laquelle vous souhaitez un financement.
        </p>
      </div>

      {/* Nom formation */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Nom de la formation
        </label>
        <input
          type="text"
          value={state.formationNom || ''}
          onChange={(e) => updateState({ formationNom: e.target.value || null })}
          placeholder="Ex: Développeur web full stack"
          className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
        />
      </div>

      {/* Type de formation */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Type de formation
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(TRAINING_TYPE_LABELS) as [TrainingType, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateState({ formationType: key })}
              className={`p-3 rounded border-2 text-sm text-left transition-all ${
                state.formationType === key
                  ? 'border-cobalt bg-cobalt-soft text-navy font-medium'
                  : 'border-rule hover:border-ink-faint text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Certification visée */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Certification visée
        </label>
        <select
          value={state.certificationLevel || ''}
          onChange={(e) => updateState({ certificationLevel: (e.target.value || null) as CertificationType | null })}
          className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
        >
          <option value="">-- Aucune / Ne sait pas --</option>
          <option value="rncp">RNCP (Répertoire National)</option>
          <option value="cqp">CQP (Certificat de Qualification Professionnelle)</option>
          <option value="diplome">Diplôme d&apos;État</option>
          <option value="habilitation">Habilitation</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Mode formation */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Mode de formation <span className="text-alert">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TRAINING_MODE_LABELS) as [TrainingMode, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateState({ trainingMode: key })}
              className={`p-3 rounded border-2 text-sm text-center transition-all ${
                state.trainingMode === key
                  ? 'border-cobalt bg-cobalt-soft text-navy font-medium'
                  : 'border-rule hover:border-ink-faint text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Durée et coûts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-soft">
            Durée (en heures) <span className="text-alert">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={state.durationHours ?? ''}
            onChange={(e) => {
              const h = e.target.value ? parseInt(e.target.value) : null;
              updateFormationCosts(state.pedagogyCostTotal, h);
            }}
            placeholder="Ex: 140"
            className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-soft">
            Coût total HT (€) <span className="text-alert">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={state.pedagogyCostTotal ?? ''}
            onChange={(e) => {
              const t = e.target.value ? parseFloat(e.target.value) : null;
              updateFormationCosts(t, state.durationHours);
            }}
            placeholder="Ex: 5600"
            className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
          />
        </div>
      </div>

      {/* Auto-calculated cost per hour */}
      {state.pedagogyCostPerHour != null && state.pedagogyCostPerHour > 0 && (
        <div className={`text-sm px-4 py-2 rounded ${ceilingWarning ? 'bg-alert-soft text-alert' : 'bg-paper-deep text-ink-soft'}`}>
          Coût horaire calculé : <span className="font-semibold">{state.pedagogyCostPerHour} €/h</span>
          {ceilingWarning && (
            <div className="mt-1 text-alert text-xs">{ceilingWarning}</div>
          )}
        </div>
      )}

      {/* Organisme */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-soft">
          Organisme de formation (optionnel)
        </label>
        <input
          type="text"
          value={state.organismeFormation || ''}
          onChange={(e) => updateState({ organismeFormation: e.target.value || null })}
          placeholder="Ex: AFPA, CNAM, organisme privé..."
          className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
        />
      </div>
    </div>
  );
}
