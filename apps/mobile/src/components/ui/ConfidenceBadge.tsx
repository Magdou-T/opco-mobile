import { Text, View } from 'react-native';
import type { Confidence } from '@opco/core';

interface ConfidenceBadgeProps {
  confidence: Confidence;
}

const CONFIDENCE_CONFIG: Record<
  Confidence,
  { label: string; container: string; text: string; icon: string }
> = {
  exact: {
    label: 'Montant exact',
    container: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: '✓',
  },
  estimated: {
    label: 'Estimation',
    container: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
    icon: '≈',
  },
  depends_on_branche: {
    label: 'Selon accord de branche',
    container: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
    icon: '?',
  },
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5 ${config.container}`}
    >
      <Text className={`text-xs font-bold ${config.text}`}>{config.icon}</Text>
      <Text className={`text-xs ${config.text}`}>{config.label}</Text>
    </View>
  );
}
