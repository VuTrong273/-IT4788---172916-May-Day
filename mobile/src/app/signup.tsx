import { useState } from 'react';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { authApi } from '@/features/auth/auth-api';

const phonePattern = /^(03|05|07|08|09)[0-9]{8}$/;
const genderOptions = [
  { value: null, label: 'Không chọn' },
  { value: 'male' as const, label: 'Nam' },
  { value: 'female' as const, label: 'Nữ' },
  { value: 'other' as const, label: 'Khác' },
];

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup() {
    if (isSubmitting) return;
    const name = fullName.trim();
    if (!name) {
      setErrorMessage('Vui lòng nhập họ tên.');
      return;
    }
    if (!phonePattern.test(phone)) {
      setErrorMessage('Số điện thoại phải có 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Hai mật khẩu không khớp.');
      return;
    }
    if (yearOfBirth && (!/^\d{4}$/.test(yearOfBirth) || Number(yearOfBirth) < 1900 || Number(yearOfBirth) > 2100)) {
      setErrorMessage('Năm sinh phải từ 1900 đến 2100.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await authApi.signup({
        full_name: name,
        phone,
        password,
        ...(gender ? { gender } : {}),
        ...(yearOfBirth ? { year_of_birth: Number(yearOfBirth) } : {}),
      });
      router.replace('/login?role=patient&registered=1');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Đăng ký thất bại.');
    } finally {
      setIsSubmitting(false);
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
          <Text style={styles.title}>Tạo tài khoản bệnh nhân</Text>
          <Text style={styles.subtitle}>
            Dùng số điện thoại và mật khẩu này để đăng nhập sau khi đăng ký.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setFullName}
                placeholder="Nhập họ và tên"
                placeholderTextColor="#91A19C"
                style={styles.input}
                value={fullName}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                autoComplete="tel"
                keyboardType="phone-pad"
                maxLength={10}
                onChangeText={setPhone}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#91A19C"
                style={styles.input}
                value={phone}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Giới tính (không bắt buộc)</Text>
              <View accessibilityLabel="Chọn giới tính" style={styles.genderOptions}>
                {genderOptions.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: gender === option.value }}
                    key={option.value}
                    onPress={() => setGender(option.value)}
                    style={[
                      styles.genderOption,
                      gender === option.value && styles.genderOptionSelected,
                    ]}>
                    <Text style={[
                      styles.genderOptionText,
                      gender === option.value && styles.genderOptionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Năm sinh (không bắt buộc)</Text>
              <TextInput
                accessibilityLabel="Năm sinh"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={setYearOfBirth}
                placeholder="YYYY"
                placeholderTextColor={appColors.muted}
                style={styles.input}
                value={yearOfBirth}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="Ít nhất 6 ký tự"
                placeholderTextColor="#91A19C"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Nhập lại mật khẩu</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor="#91A19C"
                secureTextEntry
                style={styles.input}
                value={confirmPassword}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void handleSignup()}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  title: { color: appColors.ink, fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 10, color: appColors.muted, fontSize: 15, lineHeight: 22 },
  form: { marginTop: 28, gap: 18 },
  field: { gap: 8 },
  label: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    color: appColors.ink,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  errorText: { color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: appColors.primary,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderOption: {
    minWidth: 68,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  genderOptionSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  genderOptionText: { color: appColors.muted, fontSize: 14, fontWeight: '700' },
  genderOptionTextSelected: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
});
