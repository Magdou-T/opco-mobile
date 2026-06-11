// Tableau de résultats du financement.
// Port RN de opco-funding/src/components/results/FundingBreakdown.tsx :
// lignes de financement (demandé / financé / reste), badges de confiance,
// sources cliquables, warnings, conditions, prochaines étapes, disclaimer.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Confidence, DispositifEligible, FundingResult } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';

interface Props {
  result: FundingResult;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getOverallConfidence(lines: { confidence: Confidence }[]): Confidence {
  if (lines.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (lines.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

// --- Badge de cumul d'un dispositif complémentaire ---------------------------

const CUMUL_CONFIG: Record<
  DispositifEligible['cumul'],
  { label: string; container: string; text: string }
> = {
  hors_budget: {
    label: 'Hors budget annuel',
    container: 'bg-green-50 border-green-200',
    text: 'text-green-700',
  },
  additif: {
    label: 'Cumulable',
    container: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  alternatif: {
    label: 'Alternative au PDC',
    container: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
  },
};

function CumulBadge({ cumul }: { cumul: DispositifEligible['cumul'] }) {
  const config = CUMUL_CONFIG[cumul];
  return (
    <View className={`self-start rounded-full border px-2 py-0.5 ${config.container}`}>
      <Text className={`text-xs font-medium ${config.text}`}>{config.label}</Text>
    </View>
  );
}

// --- Carte d'un dispositif complémentaire ------------------------------------

function DispositifCard({ dispositif }: { dispositif: DispositifEligible }) {
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-5">
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="flex-1 font-semibold text-gray-900">{dispositif.nom}</Text>
        <CumulBadge cumul={dispositif.cumul} />
      </View>

      <Text className="mb-2 text-base font-bold text-green-700">
        {dispositif.montantEstime != null
          ? `jusqu'à ${formatEuro(dispositif.montantEstime)}`
          : 'montant selon dossier'}
      </Text>

      {dispositif.cumul === 'alternatif' ? (
        <View className="mb-3 rounded-lg bg-purple-50 px-3 py-2">
          <Text className="text-xs text-purple-700">
            Non cumulable avec l'estimation ci-dessus — option alternative.
          </Text>
        </View>
      ) : null}

      <Text className="mb-3 text-sm text-gray-600">{dispositif.description}</Text>

      {dispositif.conditions.length > 0 && (
        <View className="mb-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
            Conditions d'attribution
          </Text>
          {dispositif.conditions.map((c, i) => (
            <Text key={i} className="mb-1 text-sm text-gray-700">
              • {c}
            </Text>
          ))}
        </View>
      )}

      <View className="mb-3">
        <Text className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
          Comment en bénéficier
        </Text>
        <Text className="text-sm text-gray-700">{dispositif.demarches}</Text>
      </View>

      {dispositif.publics ? (
        <View className="mb-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
            Publics concernés
          </Text>
          <Text className="text-sm text-gray-700">{dispositif.publics}</Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={dispositif.confidence} />
        <SourceBadge url={dispositif.sourceUrl} />
      </View>
    </View>
  );
}

export function FundingBreakdown({ result }: Props) {
  const overallConfidence = getOverallConfidence(result.lines);
  const visibleLines = result.lines.filter((l) => l.requestedAmount > 0 || l.fundedAmount > 0);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const toggleLine = (index: number) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <View className="gap-6">
      {/* Bandeau dispositif principal */}
      <View className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Text className="text-xs font-medium uppercase text-blue-500">
          Estimation au titre du
        </Text>
        <Text className="mt-0.5 text-sm font-semibold text-blue-800">
          {result.dispositifPrincipal}
        </Text>
      </View>

      {/* Barème appliqué (branche professionnelle ou barème général) */}
      {result.brancheAppliquee ? (
        <View className="-mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <Text className="text-sm font-semibold text-green-800">
            ✓ Barème appliqué : {result.brancheAppliquee}
          </Text>
        </View>
      ) : (
        <View className="-mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <Text className="text-sm text-gray-600">Barème général de l'OPCO appliqué</Text>
        </View>
      )}

      {/* Main result card */}
      <View className="rounded-xl bg-blue-600 p-6">
        <Text className="mb-1 text-sm font-medium text-blue-100">Financement estimé par</Text>
        <Text className="mb-4 text-lg font-bold text-white">{result.opcoName}</Text>
        <Text className="mb-2 text-4xl font-bold text-white">
          {formatEuro(result.totalFunded)}
        </Text>
        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          <ConfidenceBadge confidence={overallConfidence} />
          {result.budgetCapApplied && result.budgetCapAmount ? (
            <View className="rounded-full bg-white/20 px-2 py-1">
              <Text className="text-xs text-white">
                Plafond annuel appliqué : {formatEuro(result.budgetCapAmount)}
              </Text>
            </View>
          ) : null}
        </View>
        {result.totalRemainder > 0 && (
          <Text className="mt-3 text-sm text-blue-100">
            Reste à votre charge :{' '}
            <Text className="font-semibold text-white">{formatEuro(result.totalRemainder)}</Text>
          </Text>
        )}
      </View>

      {/* Enveloppe maximale potentielle */}
      <View className="rounded-xl bg-green-700 p-6">
        <Text className="mb-1 text-sm font-medium text-green-100">
          Enveloppe maximale potentielle
        </Text>
        <Text className="mb-2 text-4xl font-bold text-white">
          {formatEuro(result.enveloppeMaxPotentielle)}
        </Text>
        <Text className="text-sm text-green-100">
          dont{' '}
          <Text className="font-semibold text-white">{formatEuro(result.totalFunded)}</Text> au
          titre du plan de développement des compétences
        </Text>
        {result.budgetDejaConsomme > 0 && (
          <Text className="mt-2 text-sm text-green-100">
            après déduction de{' '}
            <Text className="font-semibold text-white">
              {formatEuro(result.budgetDejaConsomme)}
            </Text>{' '}
            déjà consommés cette année
          </Text>
        )}
      </View>

      {/* Detailed breakdown */}
      <View className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <View className="border-b border-gray-200 px-4 py-4">
          <Text className="font-semibold text-gray-900">Détail du financement</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            Touchez une ligne pour voir le détail du calcul
          </Text>
        </View>

        {visibleLines.map((line, i) => (
          <View key={i} className="border-b border-gray-100">
            <Pressable
              onPress={() => line.details?.length && toggleLine(i)}
              className="px-4 py-4 active:bg-gray-50"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-medium text-gray-900">
                  {line.details?.length ? (expandedLines.has(i) ? '▾ ' : '▸ ') : ''}
                  {line.label}
                </Text>
                <ConfidenceBadge confidence={line.confidence} />
              </View>
              {line.note ? (
                <Text className="mt-1 text-xs text-gray-500">{line.note}</Text>
              ) : null}
              <View className="mt-2 flex-row justify-between">
                <View>
                  <Text className="text-xs uppercase text-gray-400">Demandé</Text>
                  <Text className="text-sm text-gray-600">
                    {formatEuro(line.requestedAmount)}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs uppercase text-gray-400">Financé</Text>
                  <Text className="text-sm font-semibold text-green-700">
                    {formatEuro(line.fundedAmount)}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs uppercase text-gray-400">Reste</Text>
                  <Text className="text-sm text-gray-600">
                    {line.remainder > 0 ? formatEuro(line.remainder) : '—'}
                  </Text>
                </View>
              </View>
              <View className="mt-2">
                <SourceBadge url={line.sourceUrl} />
              </View>
            </Pressable>

            {/* Expandable detail section */}
            {expandedLines.has(i) && line.details && line.details.length > 0 && (
              <View className="border-t border-blue-100 bg-blue-50 px-4 py-3">
                <Text className="mb-1.5 text-xs font-medium text-blue-800">
                  Détail du calcul :
                </Text>
                {line.details.map((detail, j) => (
                  <Text key={j} className="mb-1 text-xs text-blue-700">
                    • {detail}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Totals */}
        <View className="bg-gray-50 px-4 py-4">
          <Text className="mb-2 font-semibold text-gray-900">Total</Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs uppercase text-gray-400">Demandé</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {formatEuro(result.totalRequested)}
              </Text>
            </View>
            <View>
              <Text className="text-xs uppercase text-gray-400">Financé</Text>
              <Text className="text-sm font-semibold text-green-700">
                {formatEuro(result.totalFunded)}
              </Text>
            </View>
            <View>
              <Text className="text-xs uppercase text-gray-400">Reste</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Budget cap explanation */}
      {result.budgetCapApplied && result.budgetCapAmount ? (
        <View className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <Text className="mb-2 font-semibold text-purple-800">
            Plafond budgétaire annuel appliqué
          </Text>
          <Text className="text-sm text-purple-700">
            Le total de votre financement ({formatEuro(result.totalRequested)}) dépasse le
            plafond annuel de{' '}
            <Text className="font-bold">{formatEuro(result.budgetCapAmount)}</Text> fixé par{' '}
            {result.opcoName}. Les montants de chaque poste ont été réduits
            proportionnellement pour respecter ce plafond.
          </Text>
        </View>
      ) : null}

      {/* Financements complémentaires possibles */}
      {result.dispositifsComplementaires.length > 0 && (
        <View className="gap-3">
          <View>
            <Text className="font-semibold text-gray-900">
              Financements complémentaires possibles
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">
              Dispositifs auxquels votre situation peut ouvrir droit, en plus ou à la place du
              plan de développement des compétences.
            </Text>
          </View>
          {result.dispositifsComplementaires.map((d) => (
            <DispositifCard key={d.id} dispositif={d} />
          ))}
        </View>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <View className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <Text className="mb-3 font-semibold text-orange-800">⚠ Points d'attention</Text>
          {result.warnings.map((w, i) => (
            <Text key={i} className="mb-2 text-sm text-orange-700">
              • {w}
            </Text>
          ))}
        </View>
      )}

      {/* Conditions */}
      {result.conditions.length > 0 && (
        <View className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <Text className="mb-3 font-semibold text-blue-800">Conditions d'éligibilité</Text>
          {result.conditions.map((c, i) => (
            <Text key={i} className="mb-2 text-sm text-blue-700">
              • {c}
            </Text>
          ))}
        </View>
      )}

      {/* Démarches étape par étape */}
      {result.demarches.length > 0 && (
        <View className="rounded-xl border border-gray-200 bg-white p-5">
          <Text className="mb-4 font-semibold text-gray-900">
            Vos démarches, étape par étape
          </Text>
          <View className="gap-3">
            {result.demarches.map((d, i) => (
              <View key={i} className="flex-row items-start gap-3">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                  <Text className="text-xs font-bold text-white">{i + 1}</Text>
                </View>
                <Text className="flex-1 text-sm text-gray-700">{d}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Next steps */}
      <View className="rounded-xl border border-gray-200 bg-white p-5">
        <Text className="mb-4 font-semibold text-gray-900">Prochaines étapes</Text>
        <View className="gap-3">
          {result.nextSteps.map((step, i) => (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(step.url).catch(() => {})}
              className="flex-row items-center gap-3 rounded-lg border border-gray-200 p-3 active:bg-blue-50"
              accessibilityRole="link"
            >
              <Text className="text-blue-600">↗</Text>
              <Text className="flex-1 text-sm text-gray-700">{step.label}</Text>
            </Pressable>
          ))}
          <View className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <Text className="mb-1 text-xs text-gray-500">Délai de validation</Text>
            <Text className="text-sm font-medium text-gray-900">{result.delaiValidation}</Text>
          </View>
          <View className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <Text className="mb-1 text-xs text-gray-500">Mode de paiement</Text>
            <Text className="text-sm font-medium text-gray-900">{result.modePaiement}</Text>
          </View>
        </View>
      </View>

      {/* Legal disclaimer */}
      <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <Text className="text-center text-xs text-gray-500">
          Ce calcul est une <Text className="font-bold">estimation indicative</Text>, pas un
          engagement de l'OPCO. Seul votre OPCO ({result.opcoName}) peut confirmer le montant
          exact de la prise en charge après étude de votre dossier. Les montants indiqués sont
          basés sur les critères de financement publiés par les OPCO.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(`mailto:${result.opcoEmail}`).catch(() => {})}
          accessibilityRole="link"
        >
          <Text className="mt-2 text-center text-xs text-blue-600 underline">
            Contact : {result.opcoEmail}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
