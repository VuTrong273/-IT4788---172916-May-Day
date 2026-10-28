import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChoiceField } from "@/components/forms/choice-field";
import { careers } from "@/components/forms/form-options";
import { getDemoRole } from "@/features/navigation/feature-routes";

import { clearSession, getSession, saveSession } from "@/features/auth/session";
import {
  profileApi,
  SessionExpiredError,
  type Profile,
} from "@/features/profile/profile-api";

const genderLabels = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [career, setCareer] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Profile["gender"]>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const session = await getSession();
        if (!active) return;
        if (!session) {
          router.dismissTo("/");
          return;
        }

        const data = await profileApi.getProfile(session);
        if (active) setProfile(data);
      } catch (error) {
        if (!active) return;

        if (error instanceof SessionExpiredError) {
          try {
            await clearSession();
            router.dismissTo("/");
          } catch {
            setErrorMessage("Không thể xóa phiên đã hết hạn.");
          }
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải hồ sơ.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [retryCount]);

  async function handleSave() {
    if (isSaving || !profile) return;
    const name = fullName.trim();
    if (!name) {
      setSaveError("Họ tên không được để trống.");
      return;
    }
    if (!/^(03|05|07|08|09)\d{8}$/.test(phone.trim())) {
      setSaveError("Số điện thoại cần đúng 10 số, đầu 03/05/07/08/09.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      const session = await getSession();
      if (!session) {
        router.dismissTo("/");
        return;
      }

      const updated = await profileApi.updateProfile(session, {
        full_name: name,
        phone: phone.trim(),
        gender: gender ?? null,
        ...(getDemoRole(profile.role_id) === "patient"
          ? {
              year_of_birth: birthYear ? Number(birthYear) : null,
              career: career.trim() || null,
            }
          : {}),
      });
      await saveSession({
        ...session,
        user: {
          ...session.user,
          full_name: updated.full_name,
          phone: updated.phone,
        },
      });
      setProfile(updated);
      setIsEditing(false);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await clearSession();
        router.dismissTo("/");
        return;
      }
      setSaveError(
        error instanceof Error ? error.message : "Không thể lưu hồ sơ.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Hồ sơ của tôi</Text>
        <Text style={styles.subtitle}>
          Xem và cập nhật thông tin cá nhân của bạn.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#15966C" style={styles.loading} />
        ) : errorMessage ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsLoading(true);
                setErrorMessage("");
                setRetryCount((count) => count + 1);
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <View style={styles.card}>
            {isEditing ? (
              <View style={styles.row}>
                <Text style={styles.label}>Họ tên</Text>
                <TextInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  onChangeText={setFullName}
                  placeholder="Nhập họ tên"
                  style={styles.input}
                  value={fullName}
                  maxLength={150}
                />
              </View>
            ) : (
              <ProfileRow label="Họ tên" value={profile.full_name} />
            )}
            {isEditing ? (
              <View style={styles.row}>
                <Text style={styles.label}>Số điện thoại đăng nhập</Text>
                <TextInput
                  accessibilityLabel="Số điện thoại đăng nhập"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!isSaving}
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={styles.input}
                />
                <Text style={styles.subtitle}>
                  Sau khi đổi số, bạn dùng số mới để đăng nhập.
                </Text>
              </View>
            ) : (
              <ProfileRow label="Số điện thoại" value={profile.phone} />
            )}
            <ProfileRow
              label="Email khôi phục"
              value={profile.recovery_email}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => router.push("/recovery-email")}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Thiết lập email khôi phục</Text>
            </Pressable>
            {isEditing ? (
              <ChoiceField
                label="Giới tính"
                value={gender ? genderLabels[gender] : ""}
                onChange={(value) =>
                  setGender(
                    (
                      Object.keys(genderLabels) as (keyof typeof genderLabels)[]
                    ).find((key) => genderLabels[key] === value) ?? null,
                  )
                }
                options={Object.values(genderLabels)}
                disabled={isSaving}
              />
            ) : (
              <ProfileRow
                label="Giới tính"
                value={profile.gender ? genderLabels[profile.gender] : null}
              />
            )}
            {getDemoRole(profile.role_id) === "patient" ? (
              isEditing ? (
                <>
                  <ChoiceField
                    label="Năm sinh"
                    value={birthYear}
                    onChange={setBirthYear}
                    disabled={isSaving}
                    options={Array.from(
                      { length: new Date().getFullYear() - 1899 },
                      (_, n) => String(new Date().getFullYear() - n),
                    )}
                  />
                  <ChoiceField
                    label="Nghề nghiệp"
                    value={career}
                    onChange={setCareer}
                    disabled={isSaving}
                    options={careers}
                    allowCustom
                    maxLength={150}
                  />
                </>
              ) : (
                <>
                  <ProfileRow
                    label="Năm sinh"
                    value={profile.year_of_birth?.toString()}
                  />
                  <ProfileRow label="Nghề nghiệp" value={profile.career} />
                </>
              )
            ) : null}

            {saveError ? (
              <Text style={styles.errorText}>{saveError}</Text>
            ) : null}
            {isEditing ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => {
                    setIsEditing(false);
                    setSaveError("");
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void handleSave()}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFullName(profile.full_name);
                  setBirthYear(profile.year_of_birth?.toString() ?? "");
                  setCareer(profile.career ?? "");
                  setPhone(profile.phone);
                  setGender(profile.gender ?? null);

                  setSaveError("");
                  setIsEditing(true);
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Chỉnh sửa thông tin</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "Chưa cập nhật"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5FAF8" },
  container: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 24,
  },
  title: { color: "#102A25", fontSize: 30, fontWeight: "800" },
  subtitle: { marginTop: 8, color: "#63756F", fontSize: 15, lineHeight: 22 },
  loading: { marginTop: 40 },
  card: {
    marginTop: 28,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 18,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F0",
  },
  label: { color: "#63756F", fontSize: 13 },
  value: { marginTop: 5, color: "#102A25", fontSize: 17, fontWeight: "700" },
  errorText: { color: "#A62F3D", fontSize: 15, lineHeight: 22 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#CEDBD5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#102A25",
    fontSize: 17,
  },
  actions: { flexDirection: "row", gap: 24 },
  retryButton: { alignSelf: "flex-start", marginTop: 18, paddingVertical: 10 },
  retryText: { color: "#087A55", fontSize: 16, fontWeight: "700" },
});
