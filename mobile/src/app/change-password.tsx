import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
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

import { authApi } from '@/features/auth/auth-api';
import { clearSession, getSession, type Session } from '@/features/auth/session';

export default function ChangePasswordScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getSession()
      .then((saved) => {
        if (!active) return;
        if (saved) setSession(saved);
        else router.dismissTo('/');
      })
      .catch(() => {
        if (active) router.dismissTo('/');
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleChangePassword() {
    if (!session || isSubmitting) return;
    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ ba ô mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới cần có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword === oldPassword) {
      setErrorMessage('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await authApi.changePassword(session.token, {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      await clearSession();
      router.dismissTo({ pathname: '/', params: { password_changed: '1' } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Đổi mật khẩu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#15966C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Đổi mật khẩu</Text>
          <Text style={styles.subtitle}>
            Sau khi đổi thành công, bạn cần đăng nhập lại bằng mật khẩu mới.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Mật khẩu hiện tại</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                onChangeText={setOldPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#91A19C"
                secureTextEntry
                style={styles.input}
                value={oldPassword}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                onChangeText={setNewPassword}
                placeholder="Ít nhất 6 ký tự"
                placeholderTextColor="#91A19C"
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
                autoCorrect={false}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#91A19C"
                secureTextEntry
                style={styles.input}
                value={confirmPassword}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void handleChangePassword()}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Đang đổi mật khẩu...' : 'Lưu mật khẩu mới'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: '#F5FAF8' },
  safeArea: { flex: 1, backgroundColor: '#F5FAF8' },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  title: { color: '#102A25', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 10, color: '#63756F', fontSize: 15, lineHeight: 22 },
  form: { marginTop: 28, gap: 18 },
  field: { gap: 8 },
  label: { color: '#243B35', fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#CCDAD5',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    color: '#102A25',
    fontSize: 16,
    paddingHorizontal: 16,
  },
  errorText: { color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#15966C',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
