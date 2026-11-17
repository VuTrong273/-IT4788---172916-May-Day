import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ImageBackground
        source={require('../../assets/images/login-background.jpg')}
        resizeMode="cover"
        style={styles.background}
      >
        <View style={styles.backgroundOverlay} />

        <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
      </ImageBackground>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF5FA',
  },
  loading: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },

  // Background
  background: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  backgroundOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },

  // Brand badge
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#D7EDF7',
    borderWidth: 1,
    borderColor: '#C4E4F4',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  badgeText: {
    color: '#07518A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'Montserrat',
  },

  // Heading
  title: {
    marginTop: 28,
    color: '#07518A',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -0.5,
    fontFamily: 'Montserrat',
  },
  subtitle: {
    marginTop: 14,
    color: '#66869D',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Montserrat',
  },
  successMessage: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#E7F3FA',
    borderWidth: 1,
    borderColor: '#C9E3F1',
    color: '#175B83',
    fontSize: 13,
    fontWeight: '700',
    padding: 14,
    fontFamily: 'Montserrat',
  },

  // Role selection
  sectionTitle: {
    marginTop: 36,
    marginBottom: 16,
    color: '#07518A',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Montserrat',
  },
  roleList: {
    gap: 12,
  },
  roleCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: '#C9DDE9',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 19,
    paddingVertical: 17,
  },
  roleCardSelected: {
    borderColor: '#0875B5',
    backgroundColor: '#E7F3FA',
  },
  roleCardPressed: {
    opacity: 0.75,
  },
  radio: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#9CB5C5',
    borderRadius: 12,
  },
  radioSelected: {
    borderColor: '#0875B5',
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#0875B5',
  },
  roleContent: {
    flex: 1,
  },
  roleLabel: {
    color: '#294B65',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Montserrat',
  },
  roleLabelSelected: {
    color: '#07518A',
  },
  roleDescription: {
    marginTop: 6,
    color: '#8299A9',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Montserrat',
  },

  // Continue button
  continueButton: {
    minHeight: 54,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#07518A',
    paddingHorizontal: 20,

    shadowColor: '#07518A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonPressed: {
    opacity: 0.8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: 'Montserrat',
  },
});


