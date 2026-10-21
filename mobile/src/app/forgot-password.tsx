import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi } from '@/features/auth/auth-api';
import { otpStyles as styles } from '@/features/auth/otp-styles';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (isSubmitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (step === 'reset') {
      if (!/^\d{6}$/.test(otp)) {
        setError('Mã OTP phải có 6 chữ số.');
        return;
      }
      if (newPassword.length < 6 || newPassword !== confirmPassword) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự và hai ô phải khớp nhau.');
        return;
      }
    }
    setIsSubmitting(true);
    setError('');
    try {
      if (step === 'email') {
        await authApi.forgotPassword(normalizedEmail);
        setStep('reset');
      } else {
        await authApi.resetPassword({
          email: normalizedEmail,
          otp,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
        router.replace({ pathname: '/login', params: { role: params.role ?? 'patient', password_reset: '1' } });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xử lý yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? 'Nhập email khôi phục đã xác minh của tài khoản. Chúng tôi sẽ gửi mã OTP đến email đó.'
              : 'Kiểm tra email, nhập mã 6 số và đặt mật khẩu mới. Mã có hiệu lực 10 phút.'}
          </Text>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email khôi phục</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={step === 'email'}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Nhập email đã xác minh"
                style={styles.input}
                value={email}
              />
            </View>
            {step === 'reset' ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Mã OTP</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={setOtp}
                    placeholder="6 chữ số"
                    style={styles.input}
                    value={otp}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setNewPassword}
                    secureTextEntry
                    style={styles.input}
                    value={newPassword}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={styles.input}
                    value={confirmPassword}
                  />
                </View>
                <Pressable accessibilityRole="button" onPress={() => setStep('email')}>
                  <Text style={styles.label}>Gửi lại mã</Text>
                </Pressable>
              </>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void submit()}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Đang xử lý...' : step === 'email' ? 'Gửi OTP qua email' : 'Đặt lại mật khẩu'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
