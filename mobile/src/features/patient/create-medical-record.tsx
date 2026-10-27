import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { patientRecordsApi, type ActiveTemplate } from './patient-records-api';

export function CreateMedicalRecord({ session }: { session: Session }) {
  const [templates, setTemplates] = useState<ActiveTemplate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await patientRecordsApi.activeTemplates(session);
      if (active()) { setTemplates(result); setSelected((current) => result.some((item) => item.code_template === current) ? current : null); }
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được mẫu phiếu.');
    } finally { if (active()) setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function create() {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const record = await patientRecordsApi.create(session, selected);
      router.replace({ pathname: '/medical-records/[id]', params: { id: String(record.medical_record_id) } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được bệnh án.');
      setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>BỆNH ÁN / BỆNH NHÂN</Text>
    <Text style={styles.title}>Tạo bệnh án</Text>
    <Text style={styles.subtitle}>Chọn mẫu phiếu để bắt đầu. Bệnh án mới sẽ ở trạng thái chờ bác sĩ tiếp nhận.</Text>
    <Text style={styles.section}>Mẫu phiếu</Text>
    {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
    {error ? <View style={styles.message}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(() => true)}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}
    {!loading && !error && templates.length === 0 ? <View style={styles.message}>
      <Text style={styles.emptyTitle}>Chưa có mẫu phiếu</Text>
      <Text style={styles.muted}>Quản trị viên cần tạo và kích hoạt mẫu phiếu trước khi bệnh nhân tạo bệnh án.</Text>
    </View> : null}
    {!loading && !error ? templates.map((template) => <Pressable key={template.code_template}
      accessibilityRole="radio" accessibilityState={{ selected: selected === template.code_template }}
      onPress={() => setSelected(template.code_template)} style={[styles.card, selected === template.code_template && styles.selectedCard]}>
      <View style={styles.cardRow}><Text style={styles.cardTitle}>{template.name}</Text><View style={[styles.radio, selected === template.code_template && styles.radioSelected]} /></View>
      {template.description ? <Text style={styles.muted}>{template.description}</Text> : null}
      <Text style={styles.code}>{template.code_template} · v{template.version}</Text>
    </Pressable>) : null}
    {selected ? <Pressable disabled={saving} onPress={() => void create()} style={styles.button}>
      <Text style={styles.buttonText}>{saving ? 'Đang tạo...' : 'Tạo bệnh án chờ tiếp nhận'}</Text>
    </Pressable> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  section: { marginTop: 29, marginBottom: 13, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  loading: { marginTop: 20 },
  card: { marginBottom: 11, padding: 18, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface },
  selectedCard: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: appColors.ink, fontSize: 16, fontWeight: '800' },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: appColors.border },
  radioSelected: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  muted: { marginTop: 8, color: appColors.muted, fontSize: 13, lineHeight: 20 },
  code: { marginTop: 12, color: appColors.primaryDark, fontSize: 11, fontWeight: '700' },
  message: { marginTop: 12, padding: 20, borderRadius: 18, backgroundColor: appColors.surface },
  error: { color: '#B42336', fontSize: 14, marginBottom: 10 },
  retry: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
  emptyTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 22, borderRadius: 15, backgroundColor: appColors.primary },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
});
