import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { roleOptions, type UserRole } from "@/features/auth/roles";
import { getSession } from "@/features/auth/session";

export default function HomeScreen() {
  const params = useLocalSearchParams<{ password_changed?: string }>();
  const [selectedRole, setSelectedRole] = useState<UserRole>("patient");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    getSession()
      .then((session) => {
        if (!active) return;
        if (session) router.replace('/home');
        else setIsCheckingSession(false);
      })
      .catch(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (isCheckingSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color="#15966C" style={styles.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>MAY DAY</Text>
        </View>

        <Text style={styles.title}>Chăm sóc sức khỏe{`\n`}cùng May Day</Text>
        {params.password_changed === '1' ? (
          <Text accessibilityRole="alert" style={styles.successMessage}>
            Đổi mật khẩu thành công. Vui lòng đăng nhập lại.
          </Text>
        ) : null}
        <Text style={styles.subtitle}>
          Chọn vai trò của bạn để truy cập đúng không gian làm việc.
        </Text>

        <Text style={styles.sectionTitle}>
          Bạn đang dùng ứng dụng với vai trò nào?
        </Text>

        <View style={styles.roleList}>
          {roleOptions.map((role) => {
            const isSelected = role.value === selectedRole;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={role.value}
                onPress={() => setSelectedRole(role.value)}
                style={({ pressed }) => [
                  styles.roleCard,
                  isSelected && styles.roleCardSelected,
                  pressed && styles.roleCardPressed,
                ]}
              >
                <View
                  style={[styles.radio, isSelected && styles.radioSelected]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                <View style={styles.roleContent}>
                  <Text
                    style={[
                      styles.roleLabel,
                      isSelected && styles.roleLabelSelected,
                    ]}
                  >
                    {role.label}
                  </Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/login", params: { role: selectedRole } })
          }
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueButtonText}>Tiếp tục</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5FAF8",
  },
  loading: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#D9F3E8",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: "#087A55",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 22,
    color: "#102A25",
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 43,
  },
  subtitle: {
    marginTop: 14,
    color: "#52645F",
    fontSize: 16,
    lineHeight: 24,
  },
  successMessage: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#D9F3E8',
    color: '#087A55',
    fontSize: 15,
    fontWeight: '700',
    padding: 14,
  },
  sectionTitle: {
    marginTop: 34,
    marginBottom: 14,
    color: "#193A32",
    fontSize: 17,
    fontWeight: "700",
  },
  roleList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 1,
    borderColor: "#D9E4E0",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 17,
  },
  roleCardSelected: {
    borderColor: "#15966C",
    backgroundColor: "#ECF9F4",
  },
  roleCardPressed: {
    opacity: 0.72,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#9AABA5",
    borderRadius: 11,
    marginTop: 1,
  },
  radioSelected: {
    borderColor: "#15966C",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#15966C",
  },
  roleContent: {
    flex: 1,
  },
  roleLabel: {
    color: "#243B35",
    fontSize: 16,
    fontWeight: "700",
  },
  roleLabelSelected: {
    color: "#087A55",
  },
  roleDescription: {
    marginTop: 5,
    color: "#63756F",
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    minHeight: 52,
    marginTop: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#15966C",
    paddingHorizontal: 20,
  },
  continueButtonPressed: {
    opacity: 0.75,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
