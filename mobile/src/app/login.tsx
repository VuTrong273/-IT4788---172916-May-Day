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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>+</Text>
            </View>
            <Text style={styles.brandName}>MAY DAY</Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Dành cho {roleLabels[role].toLowerCase()}</Text>
          </View>

          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để tiếp tục sử dụng May Day.
          </Text>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Thông tin đăng nhập</Text>
            <FormTextInput
              autoComplete="tel"
              control={control}
              keyboardType="phone-pad"
              label="Số điện thoại"
              maxLength={10}
              name="phone"
              onValueChange={clearMessage}
              placeholder="Nhập số điện thoại"
            />

            <FormTextInput
              autoCapitalize="none"
              autoComplete="current-password"
              accessoryLabel={isPasswordVisible ? 'Ẩn' : 'Hiện'}
              control={control}
              label="Mật khẩu"
              name="password"
              onAccessoryPress={() => setIsPasswordVisible((value) => !value)}
              onSubmitEditing={handleSubmit(handleLogin)}
              onValueChange={clearMessage}
              placeholder="Nhập mật khẩu"
              returnKeyType="done"
              secureTextEntry={!isPasswordVisible}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/forgot-password', params: { role } })}
              style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Quên mật khẩu?</Text>
            </Pressable>

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

          {role === 'patient' ? (
            <View style={styles.signupRow}>
              <Text style={styles.signupPrompt}>Chưa có tài khoản?</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/signup')}
                style={styles.signupLink}>
                <Text style={styles.signupLinkText}>Đăng ký ngay</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
