import { canOpenMobilePage } from "@/features/navigation/workspace-navigation";
import { useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { typography } from "@/constants/typography";
import { appColors } from "@/constants/app-theme";
import { roleLabels } from "@/features/auth/roles";
import { clearAuthenticatedSession } from "@/features/auth/sign-out";
import { useAuthenticatedSession } from "@/features/auth/use-authenticated-session";
import { getDemoRole } from "@/features/navigation/feature-routes";

export default function AccountScreen() {
  const session = useAuthenticatedSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (!session || isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const serverConfirmed = await clearAuthenticatedSession(session);
      router.dismissTo("/");
      if (!serverConfirmed) {
        Alert.alert(
          "Đã đăng xuất trên thiết bị",
          "Máy chủ chưa xác nhận hủy phiên. Hãy kiểm tra kết nối mạng.",
        );
      }
    } catch {
      Alert.alert("Lỗi", "Không thể xóa phiên đăng nhập trên điện thoại.");
      setIsLoggingOut(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;

  const role = getDemoRole(session.user);
  const links = [
    {
      title: "Chi tiết hồ sơ",
      glyph: "◎",
      description: "Xem và cập nhật thông tin cá nhân",
      href: "/profile" as const,
    },
    {
      title: "Email khôi phục",
      glyph: "@",
      description: "Thiết lập email nhận mã xác minh",
      href: "/recovery-email" as const,
    },
    {
      title: "Đổi mật khẩu",
      glyph: "◇",
      description: "Cập nhật mật khẩu đăng nhập",
      href: "/change-password" as const,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MAY DAY / CÁ NHÂN</Text>
        <Text style={styles.title}>Thông tin cá nhân</Text>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {session.user.full_name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.fullName}>{session.user.full_name}</Text>
            <Text style={styles.phone}>{session.user.phone}</Text>
            <Text style={styles.role}>
              {role ? roleLabels[role] : "Thành viên"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Hồ sơ và bảo mật</Text>
        <View style={styles.links}>
          {links
            .filter((link) => canOpenMobilePage(session, link.href))
            .map((link) => (
              <Pressable
                accessibilityRole="button"
                key={link.href}
                onPress={() => router.push(link.href)}
                style={({ pressed }) => [
                  styles.linkCard,
                  pressed && styles.pressed,
                ]}
              >
              <View style={styles.linkIcon}><Text style={styles.linkGlyph}>{link.glyph}</Text></View>
                <View style={styles.linkCopy}>
                  <Text style={styles.linkTitle}>{link.title}</Text>
                  <Text style={styles.linkDescription}>{link.description}</Text>
                </View>
                <Text accessibilityElementsHidden style={styles.arrow}>
                  ›
                </Text>
              </Pressable>
            ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoggingOut }}
          disabled={isLoggingOut}
          onPress={() => void handleLogout()}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.logoutText}>
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 40,
  },
  eyebrow: {
    color: appColors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    fontFamily: typography.medium,
  },
  title: {
    marginTop: 12,
    color: appColors.ink,
    fontSize: 30,
    fontWeight: "800",
    fontFamily: typography.extraBold,
  },
  identityCard: {
    marginTop: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 20,
    backgroundColor: appColors.primaryDark,
    padding: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#277A65",
  },
  avatarText: {
    color: appColors.surface,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: typography.extraBold,
  },
  identityCopy: { flex: 1 },
  fullName: {
    color: appColors.surface,
    fontSize: 19,
    fontWeight: "800",
    fontFamily: typography.extraBold,
  },
  phone: { color: "#FFFFFF", marginTop: 6, fontSize: 14, fontFamily: typography.regular },
  role: { marginTop: 5, color: "#C9E7D9", fontSize: 13 },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 13,
    color: appColors.ink,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: typography.medium,
  },
  links: { gap: 10 },
  linkCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 16,
    backgroundColor: appColors.surface,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  linkCopy: { flex: 1 },
  linkIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F3F0', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  linkGlyph: { color: appColors.primary, fontSize: 24, fontWeight: '700' },
  linkTitle: {
    color: appColors.ink,
    fontFamily: typography.extraBold,
    fontSize: 16,
    lineHeight: 24,
  },
  linkDescription: {
    marginTop: 4,
    color: appColors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  arrow: {
    color: appColors.primary,
    fontSize: 25,
    fontWeight: "800",
    fontFamily: typography.extraBold,
  },
  logoutButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 15,
    backgroundColor: appColors.surface,
  },
  logoutText: {
    color: "#A04440",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: typography.medium,
  },
  pressed: { opacity: 0.75 },
});
