'use client';

import { useState } from 'react';
import { WizardState } from '@/lib/types';
import { OPCO_LIST } from '../../../data/opcos';
import { useSirenLookup } from '@/hooks/useSirenLookup';
import { resolveIdccToOpco } from '@/lib/opco-resolver';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

export function StepIdentification({ state, updateState }: Props) {
  const [mode, setMode] = useState<'known' | 'search' | null>(
    state.opcoKnown === true ? 'known' : state.opcoKnown === false ? 'search' : null
  );
  const [searchQuery, setSearchQuery] = useState(state.companyName || '');
  const { results, loading, error, search } = useSirenLookup();

  const handleModeChange = (m: 'known' | 'search') => {
    setMode(m);
    updateState({
      opcoKnown: m === 'known',
      selectedOpcoSlug: m === 'search' ? null : state.selectedOpcoSlug,
      detectedOpcoSlug: m === 'known' ? null : state.detectedOpcoSlug,
    });
  };

  const handleOpcoSelect = (slug: string) => {
    updateState({ selectedOpcoSlug: slug, selectedBranche: null });
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    updateState({ companyName: value });
    search(value);
  };

  const handleCompanySelect = (company: (typeof results)[0]) => {
    // Single updateState call to avoid race conditions
    const baseUpdate: Partial<WizardState> = {
      companyName: company.nom_complet,
      sirenNumber: company.siren,
      detectedCompanyName: company.nom_complet,
      detectedOpcoSlug: null,
      detectedIdcc: null,
      selectedBranche: null,
    };

    // Resolve IDCC to OPCO
    if (company.liste_idcc.length > 0) {
      const resolved = resolveIdccToOpco(company.liste_idcc);
      if (resolved.length >= 1) {
        baseUpdate.detectedOpcoSlug = resolved[0].opcoSlug;
        baseUpdate.detectedIdcc = resolved[0].idcc;
      }
    }

    updateState(baseUpdate);
    setSearchQuery(company.nom_complet);
    search(''); // Clear search results
  };

  // Feedback message when company selected but no OPCO detected
  const companySelectedButNoOpco =
    state.detectedCompanyName != null &&
    state.detectedOpcoSlug == null &&
    state.selectedOpcoSlug == null;

  const effectiveSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const detectedOpco = effectiveSlug ? OPCO_LIST.find(o => o.slug === effectiveSlug) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">
          Identification de votre OPCO
        </h2>
        <p className="text-ink-soft text-sm">
          L&apos;OPCO (Opérateur de Compétences) est l&apos;organisme qui finance la formation professionnelle
          des salariés de votre entreprise.
        </p>
      </div>

      {/* Mode selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-ink-soft">
          Connaissez-vous votre OPCO ?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('known')}
            className={`p-4 rounded border-2 text-left transition-all ${
              mode === 'known'
                ? 'border-cobalt bg-cobalt-soft text-navy'
                : 'border-rule hover:border-ink-faint text-ink-soft'
            }`}
          >
            <div className="font-medium">Oui, je le connais</div>
            <div className="text-xs mt-1 opacity-70">Sélectionner dans la liste</div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('search')}
            className={`p-4 rounded border-2 text-left transition-all ${
              mode === 'search'
                ? 'border-cobalt bg-cobalt-soft text-navy'
                : 'border-rule hover:border-ink-faint text-ink-soft'
            }`}
          >
            <div className="font-medium">Non, aidez-moi</div>
            <div className="text-xs mt-1 opacity-70">Recherche par entreprise / SIREN</div>
          </button>
        </div>
      </div>

      {/* Known OPCO: dropdown */}
      {mode === 'known' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-soft">
            Sélectionnez votre OPCO
          </label>
          <select
            value={state.selectedOpcoSlug || ''}
            onChange={(e) => handleOpcoSelect(e.target.value)}
            className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
          >
            <option value="">-- Choisir un OPCO --</option>
            {OPCO_LIST.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}, {o.secteurs}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Nom de votre entreprise ou numéro SIREN
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Ex: Carrefour, 652 014 051..."
                className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-cobalt border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            {error && (
              <p className="text-red-600 text-sm mt-1">{error}</p>
            )}
          </div>

          {/* Search results */}
          {results.length > 0 && !state.detectedOpcoSlug && (
            <div className="border border-rule rounded divide-y divide-rule max-h-64 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.siren}
                  type="button"
                  onClick={() => handleCompanySelect(r)}
                  className="w-full px-4 py-3 text-left hover:bg-cobalt-soft transition-colors"
                >
                  <div className="font-medium text-ink">{r.nom_complet}</div>
                  <div className="text-xs text-ink-faint mt-0.5">
                    SIREN : {r.siren}, {r.siege.libelle_commune} ({r.siege.code_postal})
                    {r.liste_idcc.length > 0 && (
                      <span className="ml-2 text-valid">
                        IDCC : {r.liste_idcc.join(', ')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Feedback: company selected but no OPCO found */}
          {companySelectedButNoOpco && (
            <div className="bg-alert-soft border border-alert/30 rounded p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-alert flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-alert">
                    OPCO non détecté automatiquement
                  </p>
                  <p className="text-xs text-alert mt-1">
                    L&apos;entreprise <strong>{state.detectedCompanyName}</strong>{' '}n&apos;a pas de convention collective (IDCC)
                    enregistrée dans la base officielle, ou l&apos;IDCC n&apos;est pas encore référencé dans notre base.
                    Veuillez sélectionner votre OPCO manuellement ci-dessous.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fallback: manual sector selection */}
          {!state.detectedOpcoSlug && (
            <div className="pt-4 border-t border-rule">
              <label className="block text-sm font-medium text-ink-faint mb-2">
                {companySelectedButNoOpco
                  ? 'Sélectionnez votre OPCO manuellement'
                  : 'Ou sélectionnez manuellement par secteur d\u0027activité'
                }
              </label>
              <select
                value={state.selectedOpcoSlug || ''}
                onChange={(e) => updateState({ selectedOpcoSlug: e.target.value || null, selectedBranche: null })}
                className="w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
              >
                <option value="">-- Choisir un OPCO --</option>
                {OPCO_LIST.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}, {o.secteurs}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Detection result */}
      {detectedOpco && (
        <div className="bg-valid-soft border border-valid/30 rounded p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-valid" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-valid">
              OPCO détecté : {detectedOpco.name}
            </span>
          </div>
          <p className="text-sm text-valid mt-1">
            Secteurs : {detectedOpco.secteurs}
          </p>
          {state.detectedCompanyName && (
            <p className="text-xs text-valid mt-1">
              Entreprise : {state.detectedCompanyName} (SIREN : {state.sirenNumber})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
