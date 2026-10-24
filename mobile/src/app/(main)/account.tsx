import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { authApi } from '@/features/auth/auth-api';
import { roleLabels } from '@/features/auth/roles';
import { clearSession } from '@/features/auth/session';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole } from '@/features/navigation/feature-routes';

export default function AccountScreen() {
  const session = useAuthenticatedSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        Alert.alert('Đã đăng xuất trên điện thoại', 'Backend chưa xác nhận hủy token. Hãy kiểm tra kết nối mạng.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể xóa phiên đăng nhập trên điện thoại.');
      setIsLoggingOut(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;

  const role = getDemoRole(session.user.role_id);
  const links = [
    { title: 'Hồ sơ của tôi', description: 'Xem và cập nhật thông tin cá nhân', href: '/profile' as const },
    { title: 'Email khôi phục', description: 'Thiết lập email nhận mã xác minh', href: '/recovery-email' as const },
    { title: 'Đổi mật khẩu', description: 'Cập nhật mật khẩu đăng nhập', href: '/change-password' as const },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MAY DAY / TÀI KHOẢN</Text>
        <Text style={styles.title}>Tài khoản</Text>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{session.user.full_name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.fullName}>{session.user.full_name}</Text>
            <Text style={styles.role}>{role ? roleLabels[role] : 'Thành viên'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thông tin & bảo mật</Text>
        <View style={styles.links}>
          {links.map((link) => (
            <Pressable
              accessibilityRole="button"
              key={link.href}
              onPress={() => router.push(link.href)}
              style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>{link.title}</Text>
                <Text style={styles.linkDescription}>{link.description}</Text>
              </View>
              <Text accessibilityElementsHidden style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoggingOut }}
          disabled={isLoggingOut}
          onPress={() => void handleLogout()}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <Text style={styles.logoutText}>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 32, paddingBottom: 40 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  identityCard: { marginTop: 25, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 20, backgroundColor: appColors.primaryDark, padding: 20 },
  avatar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#277A65' },
  avatarText: { color: appColors.surface, fontSize: 22, fontWeight: '800' },
  identityCopy: { flex: 1 },
  fullName: { color: appColors.surface, fontSize: 19, fontWeight: '800' },
  role: { marginTop: 5, color: '#C9E7D9', fontSize: 13 },
  sectionTitle: { marginTop: 30, marginBottom: 13, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  links: { gap: 10 },
  linkCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 16, backgroundColor: appColors.surface, paddingHorizontal: 17, paddingVertical: 12 },
  linkCopy: { flex: 1 },
  linkTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  linkDescription: { marginTop: 4, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  arrow: { color: appColors.primary, fontSize: 25 },
  logoutButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 30, borderWidth: 1, borderColor: appColors.border, borderRadius: 15, backgroundColor: appColors.surface },
  logoutText: { color: '#A04440', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
