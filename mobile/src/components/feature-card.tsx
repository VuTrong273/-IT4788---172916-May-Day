
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/app-theme';
import { fontSizes, typography } from '@/constants/typography';
import type { FeatureRoute } from '@/features/navigation/feature-routes';

type Props = {
  feature: FeatureRoute;
  index?: number;
  prominent?: boolean;
};

export function FeatureCard({
  feature,
  index,
  prominent = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${feature.title}. ${feature.description}`}
      onPress={() =>
        router.push({
          pathname: '/feature/[slug]',
          params: { slug: feature.slug },
        })
      }
      style={({ pressed }) => [
        styles.card,
        prominent && styles.prominentCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconBox, prominent && styles.prominentIconBox]}>
        <Text style={[styles.iconText, prominent && styles.prominentIconText]}>
          {index === undefined
            ? '＋'
            : String(index + 1).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.copy}>
        <Text
          numberOfLines={2}
          style={[styles.title, prominent && styles.prominentText]}
        >
          {feature.title}
        </Text>

        <Text
          numberOfLines={2}
          style={[
            styles.description,
            prominent && styles.prominentDescription,
          ]}
        >
          {feature.description}
        </Text>
      </View>

      <View style={[styles.arrowBox, prominent && styles.prominentArrowBox]}>
        <Text style={[styles.arrow, prominent && styles.prominentText]}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 16,
    backgroundColor: appColors.surface,
    padding: 16,
    shadowColor: '#477C9A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 1,
  },
  prominentCard: {
    borderColor: appColors.primary,
    backgroundColor: appColors.primary,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: appColors.primarySoft,
  },
  prominentIconBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  iconText: {
    color: appColors.primary,
    fontFamily: typography.bold,
    fontSize: fontSizes.md,
  },
  prominentIconText: {
    color: '#FFFFFF',
    fontSize: fontSizes.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: appColors.ink,
    fontFamily: typography.bold,
    fontSize: fontSizes.md,
  },
  prominentText: {
    color: '#FFFFFF',
  },
  description: {
    marginTop: 5,
    color: appColors.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  prominentDescription: {
    color: '#EAF7FF',
  },
  arrowBox: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: appColors.canvas,
  },
  prominentArrowBox: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  arrow: {
    color: appColors.primary,
    fontSize: 23,
    lineHeight: 25,
  },
});
