import { Pressable, Text } from 'react-native';
import * as Linking from 'expo-linking';

interface SourceBadgeProps {
  url: string;
  label?: string;
}

/** Badge « Source » cliquable : ouvre l'URL officielle dans le navigateur. */
export function SourceBadge({ url, label = 'Source' }: SourceBadgeProps) {
  if (!url) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      className="flex-row items-center self-start rounded-full bg-blue-50 px-2 py-0.5 active:bg-blue-100"
      accessibilityRole="link"
      accessibilityLabel={`Voir la source : ${url}`}
    >
      <Text className="text-xs text-blue-700">↗ {label}</Text>
    </Pressable>
  );
}
