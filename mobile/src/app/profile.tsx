import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { clearSession, getSession, saveSession } from '@/features/auth/session';
import { getAuthenticatedRole, roleLabels } from '@/features/auth/roles';
import {
  profileApi,
  SessionExpiredError,
  type Profile,
} from '@/features/profile/profile-api';
import {
  createProfileDraft,
  getProfileChanges,
  validateProfileDraft,
  type ProfileDraft,
} from '@/features/profile/profile-form';
import { typography } from '@/constants/typography';

const genderOptions: { value: NonNullable<Profile['gender']>; label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

const patientTextFields: {
  key: Exclude<keyof ProfileDraft, 'full_name' | 'gender' | 'year_of_birth'>;
  label: string;
}[] = [
  { key: 'career', label: 'Nghề nghiệp' },
  { key: 'ethnic', label: 'Dân tộc' },
  { key: 'hamlet_address', label: 'Thôn/xóm/số nhà' },
  { key: 'commune_address', label: 'Xã/phường' },
  { key: 'city_address', label: 'Tỉnh/thành phố' },
  { key: 'work_place', label: 'Nơi làm việc' },
  { key: 'health_insurance_number', label: 'Số bảo hiểm y tế' },
  { key: 'health_insurance_validate', label: 'Hạn thẻ BHYT (YYYY-MM-DD)' },
  { key: 'next_of_kin_name', label: 'Người thân liên hệ' },
  { key: 'next_of_kin_phone', label: 'Số điện thoại người thân' },
];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const session = await getSession();
        if (!active) return;
        if (!session) {
          router.dismissTo('/');
          return;
        }

        const data = await profileApi.getProfile(session);
        if (active) {
          setProfile(data);
          setDraft(createProfileDraft(data));
        }
      } catch (error) {
        if (!active) return;

        if (error instanceof SessionExpiredError) {
          await leaveExpiredSession();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải hồ sơ.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [retryCount]);

  async function leaveExpiredSession() {
    try {
      await clearSession();
    } catch {
      // The protected screen is still removed even if local storage is unavailable.
    }
    router.dismissTo({ pathname: '/login', params: { session_expired: '1' } });
  }

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setSaveError('');
    setSuccessMessage('');
  }

  async function handleSave() {
    if (!profile || !draft || isSaving) return;
    const validationError = validateProfileDraft(draft);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const changes = getProfileChanges(profile, draft);
    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      setSaveError('');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSuccessMessage('');
    try {
      const session = await getSession();
      if (!session) {
        router.dismissTo('/');
        return;
      }

      const updated = await profileApi.updateProfile(session, changes);
      setProfile(updated);
      setDraft(createProfileDraft(updated));
      setIsEditing(false);
      setSuccessMessage('Hồ sơ đã được cập nhật.');

      try {
        await saveSession({
          ...session,
          user: { ...session.user, full_name: updated.full_name },
        });
      } catch {
        setSuccessMessage(
          'Hồ sơ đã được cập nhật trên máy chủ, nhưng tên hiển thị trong phiên chưa đồng bộ.',
        );
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await leaveExpiredSession();
        return;
      }
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    if (!profile) return;
    setDraft(createProfileDraft(profile));
    setIsEditing(false);
    setSaveError('');
    setSuccessMessage('');
  }

  const profileRole = profile ? getAuthenticatedRole(profile.role_id) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / TÀI KHOẢN</Text>
        <Text style={styles.title}>Hồ sơ của tôi</Text>
        <Text style={styles.subtitle}>Thông tin được tải và cập nhật từ hồ sơ máy chủ của bạn.</Text>

        {isLoading ? (
          <ActivityIndicator accessibilityLabel="Đang tải hồ sơ" color={appColors.primary} style={styles.loading} />
        ) : errorMessage ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsLoading(true);
                setErrorMessage('');
                setRetryCount((count) => count + 1);
              }}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Thử tải lại</Text>
            </Pressable>
          </View>
        ) : profile && draft ? (
          <View style={styles.card}>
            {isEditing ? (
              <ProfileInput
                editable={!isSaving}
                label="Họ tên"
                onChangeText={(value) => updateDraft('full_name', value)}
                value={draft.full_name}
              />
            ) : (
              <ProfileRow label="Họ tên" value={profile.full_name} />
            )}
            <ProfileRow label="Số điện thoại" value={profile.phone} />
            <ProfileRow
              label="Vai trò"
              value={profileRole ? roleLabels[profileRole] : 'Vai trò không xác định'}
            />
            <ProfileRow label="Email khôi phục" value={profile.recovery_email} />

            {profile.role_id === 3 ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Giới tính</Text>
                  {isEditing ? (
                    <View accessibilityLabel="Chọn giới tính" style={styles.genderOptions}>
                      {genderOptions.map((option) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: draft.gender === option.value }}
                          disabled={isSaving}
                          key={option.value}
                          onPress={() => updateDraft('gender', option.value)}
                          style={[
                            styles.genderOption,
                            draft.gender === option.value && styles.genderOptionSelected,
                          ]}>
                          <Text style={[
                            styles.genderOptionText,
                            draft.gender === option.value && styles.genderOptionTextSelected,
                          ]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.value}>
                      {genderOptions.find((option) => option.value === profile.gender)?.label ?? 'Chưa cập nhật'}
                    </Text>
                  )}
                </View>

                {isEditing ? (
                  <ProfileInput
                    editable={!isSaving}
                    keyboardType="number-pad"
                    label="Năm sinh"
                    onChangeText={(value) => updateDraft('year_of_birth', value)}
                    value={draft.year_of_birth}
                  />
                ) : (
                  <ProfileRow label="Năm sinh" value={profile.year_of_birth?.toString()} />
                )}

                {patientTextFields.map(({ key, label }) => (
                  isEditing ? (
                    <ProfileInput
                      editable={!isSaving}
                      key={key}
                      label={label}
                      onChangeText={(value) => updateDraft(key, value)}
                      value={draft[key]}
                    />
                  ) : (
                    <ProfileRow key={key} label={label} value={profile[key]} />
                  )
                ))}
                <ProfileRow
                  label="Lần khám đầu tiên"
                  value={profile.first_visit ? new Date(profile.first_visit).toLocaleDateString('vi-VN') : null}
                />
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/recovery-email')}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {profile.recovery_email ? 'Cập nhật email khôi phục' : 'Thiết lập email khôi phục'}
              </Text>
            </Pressable>

            {successMessage ? (
              <Text accessibilityRole="alert" style={styles.successText}>{successMessage}</Text>
            ) : null}
            {saveError ? <Text accessibilityRole="alert" style={styles.errorText}>{saveError}</Text> : null}

            {isEditing ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={cancelEdit}
                  style={[styles.secondaryButton, isSaving && styles.disabledButton]}>
                  <Text style={styles.secondaryButtonText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => void handleSave()}
                  style={[styles.primaryButton, isSaving && styles.disabledButton]}>
                  <Text style={styles.primaryButtonText}>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDraft(createProfileDraft(profile));
                  setSaveError('');
                  setSuccessMessage('');
                  setIsEditing(true);
                }}
                style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Chỉnh sửa hồ sơ</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileInput({
  editable,
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  editable: boolean;
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={label === 'Họ tên' ? 'words' : 'sentences'}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder="Chưa cập nhật"
        placeholderTextColor={appColors.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? 'Chưa cập nhật'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  container: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, fontFamily: typography.medium },
  title: { marginTop: 12, color: appColors.ink, fontSize: 30, fontWeight: '800', fontFamily: typography.semiBold },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 15, lineHeight: 22 },
  loading: { marginTop: 40 },
  card: { gap: 8, marginTop: 24, borderRadius: 18, backgroundColor: appColors.surface, padding: 18 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appColors.border },
  label: { color: appColors.muted, fontSize: 13 },
  value: { marginTop: 5, color: appColors.ink, fontSize: 16, fontWeight: '700' },
  errorText: { color: '#A04440', fontSize: 14, lineHeight: 21 },
  successText: { color: '#176B50', fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 46,
    marginTop: 7,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: appColors.ink,
    fontSize: 16,
  },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  genderOption: {
    minWidth: 68,
    minHeight: 40,
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: appColors.primary,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: appColors.surface, fontSize: 15, fontWeight: '800', fontFamily: typography.medium },
  secondaryButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', marginTop: 10, paddingHorizontal: 4 },
  secondaryButtonText: { color: appColors.primary, fontSize: 14, fontWeight: '700', fontFamily: typography.medium },
  disabledButton: { opacity: 0.6 },
});
