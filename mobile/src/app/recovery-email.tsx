import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
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
import { getSession, type Session } from '@/features/auth/session';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecoveryEmailScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getSession().then((saved) => {
      if (!active) return;
      if (saved) setSession(saved);
      else router.dismissTo('/');
    }).catch(() => {
      if (active) router.dismissTo('/');
    });
    return () => { active = false; };
  }, []);

  async function submit() {
    if (!session || isSubmitting) return;
    if (step === 'email' && (!emailPattern.test(email.trim()) || !password)) {
      setError('Nhập email hợp lệ và mật khẩu hiện tại.');
      return;
    }
    if (step === 'verify' && !/^\d{6}$/.test(otp)) {
      setError('Mã OTP phải có 6 chữ số.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      if (step === 'email') {
        await authApi.requestRecoveryEmail(session.token, email.trim().toLowerCase(), password);
        setPassword('');
        setStep('verify');
      } else {
        await authApi.verifyRecoveryEmail(session.token, otp);
        router.replace('/profile');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xử lý yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session) {
    return <SafeAreaView style={styles.safeArea}><ActivityIndicator color="#15966C" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Email khôi phục</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? 'Nhập email bạn kiểm soát. Chúng tôi sẽ gửi mã xác minh đến email đó.'
              : `Nhập mã 6 số đã gửi đến ${email}. Mã có hiệu lực 10 phút.`}
          </Text>
          <View style={styles.form}>
            {step === 'email' ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Email nhận OTP</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="ten@example.com"
                    style={styles.input}
                    value={email}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Mật khẩu hiện tại</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                </View>
              </>
            ) : (
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
            )}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void submit()}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Đang xử lý...' : step === 'email' ? 'Gửi mã xác minh' : 'Xác minh email'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
