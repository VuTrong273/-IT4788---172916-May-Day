import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormTextInput } from '@/features/auth/components/form-text-input';
import { authApi } from '@/features/auth/auth-api';
import {
  loginSchema,
  type LoginFormValues,
} from '@/features/auth/login-schema';
import { styles } from '@/features/auth/login-styles';
import { getUserRole, roleLabels } from '@/features/auth/roles';
import { saveSession } from '@/features/auth/session';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ role?: string; registered?: string; password_reset?: string }>();
  const role = getUserRole(params.role);
  const [submitMessage, setSubmitMessage] = useState(
    params.password_reset === '1'
      ? 'Đặt lại mật khẩu thành công. Hãy đăng nhập.'
      : params.registered === '1' ? 'Đăng ký thành công. Hãy đăng nhập.' : '',
  );
  const [submitError, setSubmitError] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { phone: '', password: '' },
    resolver: zodResolver(loginSchema),
  });

  async function handleLogin(values: LoginFormValues) {
    setSubmitMessage('');

    try {
      const response = await authApi.login(values);
      await saveSession({
        token: response.data.token,
        user: response.data.user_info,
      });
      router.replace('/dashboard');
    } catch (error) {
      setSubmitError(true);
      setSubmitMessage(
        error instanceof Error ? error.message : 'Đăng nhập thất bại.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabels[role]}</Text>
          </View>

          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>
            Nhập số điện thoại và mật khẩu để tiếp tục.
          </Text>

          <View style={styles.form}>
            <FormTextInput
              autoComplete="tel"
              control={control}
              keyboardType="phone-pad"
              label="Số điện thoại"
              maxLength={10}
              name="phone"
              onValueChange={() => setSubmitMessage('')}
              placeholder="Nhập số điện thoại"
            />

            <FormTextInput
              autoCapitalize="none"
              autoComplete="current-password"
              control={control}
              label="Mật khẩu"
              name="password"
              onSubmitEditing={handleSubmit(handleLogin)}
              onValueChange={() => setSubmitMessage('')}
              placeholder="Nhập mật khẩu"
              returnKeyType="done"
              secureTextEntry
            />

            {submitMessage ? (
              <View
                accessibilityRole="alert"
                style={[styles.messageBox, submitError && styles.errorBox]}>
                <Text style={[styles.messageText, submitError && styles.errorMessage]}>
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
              ]}>
              <Text style={styles.loginButtonText}>
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/forgot-password', params: { role } })}
            style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Quên mật khẩu?</Text>
          </Pressable>

          {role === 'patient' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/signup')}
              style={styles.signupLink}>
              <Text style={styles.signupLinkText}>Chưa có tài khoản? Đăng ký</Text>
            </Pressable>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
