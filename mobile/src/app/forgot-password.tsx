import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authApi, shouldClearAuthSecrets } from '@/features/auth/auth-api';
import { styles } from '@/features/auth/login-styles';

import { AuthLayout } from '@/features/auth/components/auth-layout';

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

      if (newPassword.length < 6) {
        setError('Mật khẩu mới cần có ít nhất 6 ký tự.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
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

        router.replace({
          pathname: '/login',
          params: {
            role: params.role ?? 'patient',
            password_reset: '1',
          },
        });
      }
    } catch (caught) {
      if (step === 'reset' && shouldClearAuthSecrets(caught)) {
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
      }

      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể xử lý yêu cầu.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      role={params.role}
      title="QUÊN MẬT KHẨU"
      subtitle={
        step === 'email'
          ? 'Nhập email khôi phục đã xác minh của tài khoản. Chúng tôi sẽ gửi mã OTP đến email đó.'
          : 'Kiểm tra email, nhập mã OTP và thiết lập mật khẩu mới. Mã có hiệu lực trong 10 phút.'
      }
    >
      <View style={styles.authForm}>
        {/* Email */}
        <View style={styles.authField}>
          <Text style={styles.authLabel}>Email khôi phục</Text>

          <TextInput
            accessibilityLabel="Email khôi phục"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={step === 'email'}
            keyboardType="email-address"
            maxLength={254}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            placeholder="Nhập email đã xác minh"
            placeholderTextColor="#8299A9"
            style={styles.authInput}
            value={email}
          />
        </View>

        {step === 'reset' && (
          <>
            <View style={styles.authField}>
              <Text style={styles.authLabel}>Mã OTP</Text>
              <TextInput
                accessibilityLabel="Mã OTP"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) =>
                  setOtp(value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Nhập mã OTP gồm 6 chữ số"
                placeholderTextColor="#8299A9"
                style={styles.authInput}
                value={otp}
              />
            </View>

            <View style={styles.authField}>
              <Text style={styles.authLabel}>Mật khẩu mới</Text>
              <TextInput
                accessibilityLabel="Mật khẩu mới"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor="#8299A9"
                secureTextEntry
                style={styles.authInput}
                value={newPassword}
              />
            </View>

            <View style={styles.authField}>
              <Text style={styles.authLabel}>
                Xác nhận mật khẩu mới
              </Text>
              <TextInput
                accessibilityLabel="Xác nhận mật khẩu mới"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#8299A9"
                secureTextEntry
                style={styles.authInput}
                value={confirmPassword}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep('email');
                setOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
              style={styles.authSecondaryButton}
            >
              <Text style={styles.authSecondaryButtonText}>
                Gửi lại mã OTP
              </Text>
            </Pressable>
          </>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={styles.authError}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.authPrimaryButton,
            pressed && { opacity: 0.8 },
            isSubmitting && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.authPrimaryButtonText}>
            {isSubmitting
              ? 'ĐANG XỬ LÝ...'
              : step === 'email'
                ? 'GỬI OTP QUA EMAIL'
                : 'ĐẶT LẠI MẬT KHẨU'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace({
            pathname: '/login',
            params: { role: params.role ?? 'patient' },
          })}
          style={styles.authSecondaryButton}
        >
          <Text style={styles.authSecondaryButtonText}>
            ← QUAY LẠI ĐĂNG NHẬP
          </Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
