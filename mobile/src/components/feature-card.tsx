import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/app-theme';
import type { FeatureRoute } from '@/features/navigation/feature-routes';

type Props = {
  feature: FeatureRoute;
  index?: number;
  prominent?: boolean;
};

export function FeatureCard({ feature, index, prominent = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: feature.slug } })}
      style={({ pressed }) => [
        styles.card,
        prominent && styles.prominentCard,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.number, prominent && styles.prominentNumber]}>
        <Text style={[styles.numberText, prominent && styles.prominentNumberText]}>
          {index === undefined ? '+' : String(index + 1).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, prominent && styles.prominentText]}>{feature.title}</Text>
        <Text style={[styles.description, prominent && styles.prominentDescription]}>
          {feature.description}
        </Text>
      </View>
      <Text accessibilityElementsHidden style={[styles.arrow, prominent && styles.prominentText]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 18,
    backgroundColor: appColors.surface,
    padding: 16,
  },
  prominentCard: {
    borderColor: appColors.primaryDark,
    backgroundColor: appColors.primaryDark,
  },
  pressed: { opacity: 0.78 },
  number: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: appColors.primarySoft,
  },
  prominentNumber: { backgroundColor: '#247964' },
  numberText: { color: appColors.primaryDark, fontSize: 13, fontWeight: '800' },
  prominentNumberText: { color: appColors.surface, fontSize: 19 },
  copy: { flex: 1 },
  title: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  prominentText: { color: appColors.surface },
  description: { marginTop: 5, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  prominentDescription: { color: '#D3EDE2' },
  arrow: { color: appColors.primary, fontSize: 25 },
});
