// Étape 1 — Identification de l'OPCO.
// Port RN de opco-funding/src/components/wizard/StepIdentification.tsx :
// recherche entreprise (SIREN, API directe) OU sélection manuelle de l'OPCO.

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import {
  resolveIdccToOpco,
  type SirenSearchResult,
  type WizardState,
} from '@opco/core';
import { useSirenLookup } from '@/hooks/useSirenLookup';
import { ChoiceButton, OpcoPicker } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  opcoList: { slug: string; name: string; secteurs: string }[];
}

export function StepIdentification({ state, updateState, opcoList }: Props) {
  const [mode, setMode] = useState<'known' | 'search' | null>(
    state.opcoKnown === true ? 'known' : state.opcoKnown === false ? 'search' : null,
  );
  const [searchQuery, setSearchQuery] = useState(state.companyName || '');
  const { results, loading, error, isOffline, search } = useSirenLookup();

  const handleModeChange = (m: 'known' | 'search') => {
    setMode(m);
    updateState({
      opcoKnown: m === 'known',
      selectedOpcoSlug: m === 'search' ? null : state.selectedOpcoSlug,
      detectedOpcoSlug: m === 'known' ? null : state.detectedOpcoSlug,
    });
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    updateState({ companyName: value });
    search(value);
  };

  const handleCompanySelect = (company: SirenSearchResult) => {
    // Single updateState call to avoid race conditions
    const baseUpdate: Partial<WizardState> = {
      companyName: company.nom_complet,
      sirenNumber: company.siren,
      detectedCompanyName: company.nom_complet,
      detectedOpcoSlug: null,
      detectedIdcc: null,
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

  const companySelectedButNoOpco =
    state.detectedCompanyName != null &&
    state.detectedOpcoSlug == null &&
    state.selectedOpcoSlug == null;

  const effectiveSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const detectedOpco = effectiveSlug
    ? opcoList.find((o) => o.slug === effectiveSlug)
    : null;

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">
          Identification de votre OPCO
        </Text>
        <Text className="text-sm text-gray-600">
          L'OPCO (Opérateur de Compétences) est l'organisme qui finance la formation
          professionnelle des salariés de votre entreprise.
        </Text>
      </View>

      {/* Mode selection */}
      <View className="gap-3">
        <Text className="text-sm font-medium text-gray-700">
          Connaissez-vous votre OPCO ?
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <ChoiceButton
              label="Oui, je le connais"
              sublabel="Sélectionner dans la liste"
              selected={mode === 'known'}
              onPress={() => handleModeChange('known')}
            />
          </View>
          <View className="flex-1">
            <ChoiceButton
              label="Non, aidez-moi"
              sublabel="Recherche par entreprise / SIREN"
              selected={mode === 'search'}
              onPress={() => handleModeChange('search')}
            />
          </View>
        </View>
      </View>

      {/* Known OPCO: picker */}
      {mode === 'known' && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Sélectionnez votre OPCO</Text>
          <OpcoPicker
            options={opcoList}
            selectedSlug={state.selectedOpcoSlug}
            onSelect={(slug) => updateState({ selectedOpcoSlug: slug })}
          />
        </View>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <View className="gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              Nom de votre entreprise ou numéro SIREN
            </Text>
            <View className="relative">
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchInput}
                placeholder="Ex: Carrefour, 652 014 051..."
                placeholderTextColor="#9ca3af"
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-gray-900"
                autoCorrect={false}
              />
              {loading && (
                <View className="absolute right-3 top-0 h-full justify-center">
                  <ActivityIndicator size="small" color="#3b82f6" />
                </View>
              )}
            </View>
            {error && (
              <View
                className={`mt-2 rounded-lg p-3 ${isOffline ? 'border border-amber-200 bg-amber-50' : ''}`}
              >
                <Text className={`text-sm ${isOffline ? 'text-amber-800' : 'text-red-600'}`}>
                  {error}
                </Text>
                {isOffline && (
                  <Text className="mt-1 text-xs text-amber-700">
                    Hors connexion ? Utilisez « Oui, je le connais » ou la liste ci-dessous
                    pour choisir votre OPCO manuellement.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Search results */}
          {results.length > 0 && !state.detectedOpcoSlug && (
            <View className="max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {results.map((r, i) => (
                <Pressable
                  key={r.siren || String(i)}
                  onPress={() => handleCompanySelect(r)}
                  className={`px-4 py-3 active:bg-blue-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <Text className="font-medium text-gray-900">{r.nom_complet}</Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    SIREN : {r.siren} — {r.siege.libelle_commune} ({r.siege.code_postal})
                    {r.liste_idcc.length > 0 ? (
                      <Text className="text-green-600">
                        {'  '}IDCC : {r.liste_idcc.join(', ')}
                      </Text>
                    ) : null}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Feedback: company selected but no OPCO found */}
          {companySelectedButNoOpco && (
            <View className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-medium text-amber-800">
                ⚠ OPCO non détecté automatiquement
              </Text>
              <Text className="mt-1 text-xs text-amber-700">
                L'entreprise{' '}
                <Text className="font-semibold">{state.detectedCompanyName}</Text> n'a pas de
                convention collective (IDCC) enregistrée dans la base officielle, ou l'IDCC
                n'est pas encore référencé dans notre base. Veuillez sélectionner votre OPCO
                manuellement ci-dessous.
              </Text>
            </View>
          )}

          {/* Fallback: manual selection */}
          {!state.detectedOpcoSlug && (
            <View className="gap-2 border-t border-gray-200 pt-4">
              <Text className="text-sm font-medium text-gray-500">
                {companySelectedButNoOpco
                  ? 'Sélectionnez votre OPCO manuellement'
                  : "Ou sélectionnez manuellement par secteur d'activité"}
              </Text>
              <OpcoPicker
                options={opcoList}
                selectedSlug={state.selectedOpcoSlug}
                onSelect={(slug) => updateState({ selectedOpcoSlug: slug || null })}
              />
            </View>
          )}
        </View>
      )}

      {/* Detection result */}
      {detectedOpco && (
        <View className="rounded-lg border border-green-200 bg-green-50 p-4">
          <Text className="font-semibold text-green-800">
            ✓ OPCO détecté : {detectedOpco.name}
          </Text>
          <Text className="mt-1 text-sm text-green-700">
            Secteurs : {detectedOpco.secteurs}
          </Text>
          {state.detectedCompanyName ? (
            <Text className="mt-1 text-xs text-green-600">
              Entreprise : {state.detectedCompanyName} (SIREN : {state.sirenNumber})
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
