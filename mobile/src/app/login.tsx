
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormTextInput } from '@/features/auth/components/form-text-input';
import { authApi, shouldClearAuthSecrets } from '@/features/auth/auth-api';
import {
  loginSchema,
  type LoginFormValues,
} from '@/features/auth/login-schema';
import { styles } from '@/features/auth/login-styles';
import { getUserRole, roleLabels } from '@/features/auth/roles';
import { saveSession } from '@/features/auth/session';

export default function LoginScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    registered?: string;
    password_reset?: string;
    session_expired?: string;
    session_cleanup_failed?: string;
  }>();

  const role = getUserRole(params.role);

  const initialMessage = params.session_expired === '1'
    ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    : params.session_cleanup_failed === '1'
      ? 'Mật khẩu đã được đổi trên máy chủ, nhưng phiên cũ chưa thể xóa khỏi thiết bị. Hãy đăng nhập bằng mật khẩu mới.'
      : params.password_reset === '1'
        ? 'Đặt lại mật khẩu thành công. Hãy đăng nhập.'
        : params.registered === '1'
          ? 'Đăng ký thành công. Hãy đăng nhập.'
          : '';

  const [submitMessage, setSubmitMessage] = useState(initialMessage);
  const [submitError, setSubmitError] = useState(
    params.session_expired === '1' || params.session_cleanup_failed === '1',
  );
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { phone: '', password: '' },
    resolver: zodResolver(loginSchema),
  });

  async function handleLogin(values: LoginFormValues) {
    setSubmitMessage('');
    setSubmitError(false);

    try {
      const response = await authApi.login(values);

      await saveSession({
        token: response.data.token,
        user: response.data.user_info,
      });

      router.replace('/home');
    } catch (error) {
      if (shouldClearAuthSecrets(error)) {
        setValue('password', '');
      }

      setSubmitError(true);
      setSubmitMessage(
        error instanceof Error ? error.message : 'Đăng nhập thất bại.',
      );
    }
  }

  function clearMessage() {
    setSubmitMessage('');
    setSubmitError(false);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ImageBackground
          source={require('../../assets/images/login-background.jpg')}
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
          {/* Brand header */}
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

          {/* Login card */}
          <View style={styles.loginCard}>
            <View style={styles.cardHeading}>
              <Text style={styles.title}>ĐĂNG NHẬP</Text>
              <Text style={styles.subtitle}>
                Chào mừng bạn đến với hệ thống MayDay
              </Text>
            </View>

            <View style={styles.form}>
              <FormTextInput
                autoComplete="tel"
                control={control}
                keyboardType="phone-pad"
                label="Tài khoản"
                maxLength={10}
                name="phone"
                onValueChange={clearMessage}
                placeholder="Nhập số điện thoại đăng nhập..."
              />

              <FormTextInput
                autoCapitalize="none"
                autoComplete="current-password"
                accessoryLabel={isPasswordVisible ? 'Ẩn' : 'Hiện'}
                control={control}
                label="Mật khẩu"
                name="password"
                onAccessoryPress={() =>
                  setIsPasswordVisible((value) => !value)
                }
                onSubmitEditing={handleSubmit(handleLogin)}
                onValueChange={clearMessage}
                placeholder="Nhập mật khẩu..."
                returnKeyType="done"
                secureTextEntry={!isPasswordVisible}
              />

              <View style={styles.formOptions}>
                <View style={styles.roleDescription}>
                  <Text style={styles.roleDescriptionIcon}>✓</Text>
                  <Text style={styles.roleDescriptionText}>
                    Dành cho {roleLabels[role]}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/forgot-password',
                      params: { role },
                    })
                  }
                  style={styles.forgotLink}
                >
                  <Text style={styles.forgotLinkText}>
                    Quên mật khẩu?
                  </Text>
                </Pressable>
              </View>

              {submitMessage ? (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.messageBox,
                    submitError && styles.errorBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      submitError && styles.errorMessage,
                    ]}
                  >
                    {submitMessage}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting }}
                disabled={isSubmitting}
                onPress={handleSubmit(handleLogin)}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && styles.loginButtonPressed,
                  isSubmitting && styles.loginButtonDisabled,
                ]}
              >
                <Text style={styles.loginButtonText}>
                  {isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
              >
                <Text style={styles.backButtonText}>← Quay lại</Text>
              </Pressable>

              {/* Patient information */}
              <View style={styles.patientNotice}>
                <Text style={styles.patientNoticeTitle}>
                  Bệnh nhân ngoại trú
                </Text>

                <Text style={styles.patientNoticeText}>
                  Vui lòng sử dụng <Text style={styles.patientNoticeBold}>
                    Ứng dụng di động MayDay
                  </Text> để tự khai báo thông số cơ thể, chấm điểm
                  UAS7/AAS7 và tải ảnh tiến triển tổn thương.
                </Text>
              </View>
            </View>

            {role === 'patient' ? (
              <View style={styles.signupRow}>
                <Text style={styles.signupPrompt}>
                  Chưa có tài khoản?
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/signup')}
                  style={styles.signupLink}
                >
                  <Text style={styles.signupLinkText}>
                    Đăng ký ngay
                  </Text>
                </Pressable>
              </View>
            ) : null}
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

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
