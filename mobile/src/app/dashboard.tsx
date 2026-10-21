import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi } from '@/features/auth/auth-api';
import { clearSession, getSession, type Session } from '@/features/auth/session';

export default function DashboardScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSession(null);

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
    }, []),
  );

  async function handleLogout() {
    if (!session || isLoggingOut) return;
    setIsLoggingOut(true);

    let serverLogoutFailed = false;
    try {
      await authApi.logout(session.token);
    } catch {
      serverLogoutFailed = true;
    }

    try {
      await clearSession();
      router.dismissTo('/');
      if (serverLogoutFailed) {
        Alert.alert(
          'Đã đăng xuất trên điện thoại',
          'Backend chưa xác nhận hủy token. Hãy kiểm tra kết nối mạng.',
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể xóa phiên đăng nhập trên điện thoại.');
      setIsLoggingOut(false);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>MAY DAY</Text>
        <Text style={styles.title}>Xin chào, {session.user.full_name}</Text>
        <Text style={styles.description}>
          Bạn đã vào màn hình chính. Phiên đăng nhập được đọc từ SecureStore.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Xem hồ sơ của tôi</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoggingOut }}
          disabled={isLoggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.button,
            styles.logoutButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.buttonText}>
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: '#F5FAF8' },
  container: { flex: 1, backgroundColor: '#F5FAF8' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  eyebrow: { color: '#087A55', fontSize: 13, fontWeight: '800' },
  title: { marginTop: 18, color: '#102A25', fontSize: 30, fontWeight: '800' },
  description: { marginTop: 12, color: '#63756F', fontSize: 16, lineHeight: 24 },
  button: {
    minHeight: 54,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#15966C',
  },
  pressed: { opacity: 0.75 },
  logoutButton: { marginTop: 12, backgroundColor: '#57716A' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
