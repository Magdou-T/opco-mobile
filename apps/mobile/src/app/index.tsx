// Écran d'accueil : présentation, état du dataset (« Données à jour au … »),
// bouton « Vérifier les mises à jour » (syncDataset) et entrée dans le wizard.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveOpcos } from '@/hooks/useActiveOpcos';
import { formatDateFr, syncDataset, type SyncResult } from '@/lib/dataset-sync';

export default function HomeScreen() {
  const router = useRouter();
  const { loading, opcos, source, version, generatedAt, reload } = useActiveOpcos();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncDataset();
      setSyncResult(result);
      if (result.status === 'updated') {
        await reload();
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-5 gap-6">
      {/* Hero */}
      <View className="rounded-xl bg-blue-600 p-6">
        <Text className="text-2xl font-bold text-white">
          Calculez le financement de votre formation
        </Text>
        <Text className="mt-2 text-sm text-blue-100">
          Estimez en 5 étapes la prise en charge de votre formation professionnelle par votre
          OPCO : coûts pédagogiques, salaires, frais annexes.
        </Text>
        <Pressable
          onPress={() => router.push('/wizard')}
          className="mt-5 items-center rounded-lg bg-white px-6 py-3 active:bg-blue-50"
          accessibilityRole="button"
        >
          <Text className="text-base font-semibold text-blue-700">Démarrer la simulation</Text>
        </Pressable>
      </View>

      {/* Dataset status */}
      <View className="rounded-xl border border-gray-200 bg-white p-5">
        <Text className="font-semibold text-gray-900">Données OPCO</Text>
        {loading ? (
          <ActivityIndicator className="mt-3" color="#2563eb" />
        ) : (
          <>
            <Text className="mt-2 text-sm text-gray-600">
              Données à jour au{' '}
              <Text className="font-semibold text-gray-900">{formatDateFr(generatedAt)}</Text>
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              {opcos.length} OPCO — version {version} —{' '}
              {source === 'cache' ? 'dataset téléchargé' : 'données embarquées'}
            </Text>
          </>
        )}

        <Pressable
          onPress={handleSync}
          disabled={syncing}
          className={`mt-4 items-center rounded-lg border px-4 py-3 ${
            syncing ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50 active:bg-blue-100'
          }`}
          accessibilityRole="button"
        >
          {syncing ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-sm font-medium text-gray-500">Vérification…</Text>
            </View>
          ) : (
            <Text className="text-sm font-medium text-blue-700">Vérifier les mises à jour</Text>
          )}
        </Pressable>

        {syncResult && (
          <View
            className={`mt-3 rounded-lg border p-3 ${
              syncResult.status === 'updated'
                ? 'border-green-200 bg-green-50'
                : syncResult.status === 'up-to-date'
                  ? 'border-gray-200 bg-gray-50'
                  : 'border-amber-200 bg-amber-50'
            }`}
          >
            <Text
              className={`text-sm ${
                syncResult.status === 'updated'
                  ? 'text-green-800'
                  : syncResult.status === 'up-to-date'
                    ? 'text-gray-700'
                    : 'text-amber-800'
              }`}
            >
              {syncResult.message}
            </Text>
          </View>
        )}
      </View>

      {/* How it works */}
      <View className="rounded-xl border border-gray-200 bg-white p-5">
        <Text className="mb-3 font-semibold text-gray-900">Comment ça marche ?</Text>
        {[
          'Identifiez votre OPCO (recherche entreprise / SIREN ou sélection manuelle)',
          'Décrivez votre situation professionnelle',
          'Renseignez la formation souhaitée',
          'Ajoutez vos frais annexes éventuels',
          'Obtenez une estimation détaillée et sourcée',
        ].map((step, i) => (
          <View key={i} className="mb-2 flex-row items-start gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
              <Text className="text-xs font-bold text-blue-700">{i + 1}</Text>
            </View>
            <Text className="flex-1 text-sm text-gray-600">{step}</Text>
          </View>
        ))}
      </View>

      {/* Disclaimer */}
      <Text className="px-2 text-center text-xs text-gray-400">
        Les résultats sont des estimations indicatives, pas un engagement de l'OPCO. L'app
        fonctionne entièrement hors-ligne avec les données embarquées.
      </Text>
    </ScrollView>
  );
}
