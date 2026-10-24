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

import { clearSession, getSession, saveSession } from '@/features/auth/session';
import {
  profileApi,
  SessionExpiredError,
  type Profile,
} from '@/features/profile/profile-api';

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
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
        if (active) setProfile(data);
      } catch (error) {
        if (!active) return;

        if (error instanceof SessionExpiredError) {
          try {
            await clearSession();
            router.dismissTo('/');
          } catch {
            setErrorMessage('Không thể xóa phiên đã hết hạn.');
          }
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể tải hồ sơ.',
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
    const name = fullName.trim();
    if (!name) {
      setSaveError('Họ tên không được để trống.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      const session = await getSession();
      if (!session) {
        router.dismissTo('/');
        return;
      }

      const updated = await profileApi.updateProfile(session, { full_name: name });
      await saveSession({
        ...session,
        user: { ...session.user, full_name: updated.full_name },
      });
      setProfile(updated);
      setIsEditing(false);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await clearSession();
        router.dismissTo('/');
        return;
      }
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
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
                setErrorMessage('');
                setRetryCount((count) => count + 1);
              }}
              style={styles.retryButton}>
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
                />
              </View>
            ) : (
              <ProfileRow label="Họ tên" value={profile.full_name} />
            )}
            <ProfileRow label="Số điện thoại" value={profile.phone} />
            <ProfileRow label="Email khôi phục" value={profile.recovery_email} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/recovery-email')}
              style={styles.retryButton}>
              <Text style={styles.retryText}>Thiết lập email khôi phục</Text>
            </Pressable>
            <ProfileRow
              label="Giới tính"
              value={profile.gender ? genderLabels[profile.gender] : null}
            />
            <ProfileRow
              label="Năm sinh"
              value={profile.year_of_birth?.toString()}
            />
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            {isEditing ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => {
                    setIsEditing(false);
                    setSaveError('');
                  }}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void handleSave()}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFullName(profile.full_name);
                  setSaveError('');
                  setIsEditing(true);
                }}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Chỉnh sửa họ tên</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  safeArea: { flex: 1, backgroundColor: '#F5FAF8' },
  container: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24 },
  title: { color: '#102A25', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 8, color: '#63756F', fontSize: 15, lineHeight: 22 },
  loading: { marginTop: 40 },
  card: { marginTop: 28, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 18 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F0' },
  label: { color: '#63756F', fontSize: 13 },
  value: { marginTop: 5, color: '#102A25', fontSize: 17, fontWeight: '700' },
  errorText: { color: '#A62F3D', fontSize: 15, lineHeight: 22 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CEDBD5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#102A25',
    fontSize: 17,
  },
  actions: { flexDirection: 'row', gap: 24 },
  retryButton: { alignSelf: 'flex-start', marginTop: 18, paddingVertical: 10 },
  retryText: { color: '#087A55', fontSize: 16, fontWeight: '700' },
});
