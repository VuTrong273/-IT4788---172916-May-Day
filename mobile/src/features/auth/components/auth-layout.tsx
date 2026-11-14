
import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/features/auth/login-styles';
import { getUserRole, roleLabels } from '@/features/auth/roles';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  role?: string;
  children: ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  role: roleParam,
  children,
}: AuthLayoutProps) {
  const role = getUserRole(roleParam);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Tắt header mặc định của Expo Router để không bị tiêu đề lặp */}
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.authRoot}>
          <ImageBackground
            source={require('../../../../assets/images/login-background.jpg')}
            resizeMode="cover"
            style={styles.background}
          >
            <View style={styles.backgroundOverlay} />
          </ImageBackground>

          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header MAYDAY */}
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>+</Text>
                </View>

                <View>
                  <Text style={styles.brandName}>MAYDAY</Text>
                  <Text style={styles.brandDescription}>
                    Clinical AI Care
                  </Text>
                </View>
              </View>

              <View style={styles.hospitalHeader}>
                <View style={styles.hospitalNameRow}>
                  <Text style={styles.hospitalPlus}>+</Text>
                  <Text style={styles.hospitalName}>
                    BỆNH VIỆN DA LIỄU TRUNG ƯƠNG
                  </Text>
                </View>

                <Text style={styles.hospitalEnglish}>
                  NATIONAL HOSPITAL OF DERMATOLOGY AND VENEREOLOGY
                </Text>

                <Text style={styles.hospitalSubtitle}>
                  HỆ THỐNG QUẢN LÝ VÀ THEO DÕI ĐIỀU TRỊ BỆNH MÀY ĐAY
                  {' '}(MAYDAY)
                </Text>
              </View>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  CỔNG {roleLabels[role].toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.headerDivider} />

            {/* Khung nội dung dùng chung */}
            <View style={styles.loginCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              {children}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                © 2026 BỆNH VIỆN DA LIỄU TRUNG ƯƠNG
              </Text>
              <Text style={styles.footerSubtext}>
                MAYDAY HEALTHCARE SYSTEM
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
