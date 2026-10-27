import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { templatesApi, type TemplateItem } from './templates-api';

export function ManageTemplates({ session }: { session: Session }) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [active, setActive] = useState<'0' | '1'>('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (alive: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await templatesApi.list(session);
      if (alive()) setTemplates(data);
    } catch (caught) {
      if (alive()) setError(caught instanceof Error ? caught.message : 'Không tải được mẫu phiếu.');
    } finally { if (alive()) setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void load(() => alive);
    return () => { alive = false; };
  }, [load]));

  async function create() {
    if (saving) return;
    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();
    const normalizedVersion = version.trim();
    if (!normalizedCode || !normalizedName || !normalizedVersion) {
      setError('Nhập mã, tên và phiên bản mẫu phiếu.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await templatesApi.create(session, {
        code_template: normalizedCode,
        name: normalizedName,
        description: description.trim(),
        version: normalizedVersion,
        is_active: active,
      });
      setTemplates((current) => [created, ...current]);
      setCode(''); setName(''); setDescription(''); setVersion('1.0'); setActive('0');
      setNotice(`Đã tạo mẫu ${created.code_template}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được mẫu phiếu.');
    } finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>QUẢN TRỊ / MẪU PHIẾU</Text>
    <Text style={styles.title}>Mẫu phiếu</Text>
    <Text style={styles.subtitle}>Tạo thông tin mẫu phiếu trước khi xây các phần và câu hỏi.</Text>

    <View style={styles.form}>
      <Text style={styles.formTitle}>Tạo mẫu mới</Text>
      <Text style={styles.label}>Mã mẫu phiếu</Text>
      <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="VD: TPL_INTAKE_V1" style={styles.input} maxLength={225} />
      <Text style={styles.label}>Tên mẫu phiếu</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Tên hiển thị cho bệnh nhân" style={styles.input} maxLength={255} />
      <Text style={styles.label}>Mô tả</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Mô tả ngắn" multiline style={[styles.input, styles.description]} />
      <Text style={styles.label}>Phiên bản</Text>
      <TextInput value={version} onChangeText={setVersion} placeholder="1.0" style={styles.input} maxLength={20} />
      <Pressable onPress={() => setActive((value) => value === '1' ? '0' : '1')} style={styles.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: active === '1' }}>
        <View style={[styles.checkbox, active === '1' && styles.checked]} />
        <View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Kích hoạt mẫu</Text>
          <Text style={styles.muted}>Mẫu hoạt động sẽ xuất hiện khi bệnh nhân tạo bệnh án.</Text></View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}
      <Pressable disabled={saving} onPress={() => void create()} style={styles.button}><Text style={styles.buttonText}>{saving ? 'Đang tạo...' : 'Tạo mẫu phiếu'}</Text></Pressable>
    </View>

    <Text style={styles.section}>Các mẫu đã tạo</Text>
    {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
    {!loading && templates.length === 0 ? <Text style={styles.muted}>Chưa có mẫu phiếu nào.</Text> : null}
    {!loading ? templates.map((template) => <View key={template.code_template} style={styles.card}>
      <View style={styles.cardRow}><Text style={styles.cardTitle}>{template.name}</Text>
        <Text style={[styles.status, template.is_active === '1' && styles.activeStatus]}>{template.is_active === '1' ? 'Hoạt động' : 'Chưa kích hoạt'}</Text></View>
      <Text style={styles.code}>{template.code_template} · v{template.version}</Text>
      {template.description ? <Text style={styles.muted}>{template.description}</Text> : null}
    </View>) : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  form: { marginTop: 26, padding: 20, borderRadius: 20, backgroundColor: appColors.surface, borderWidth: 1, borderColor: appColors.border },
  formTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  label: { marginTop: 18, marginBottom: 7, color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: appColors.border, color: appColors.ink, backgroundColor: appColors.surface, fontSize: 14 },
  description: { minHeight: 84, paddingTop: 13, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  checkbox: { width: 21, height: 21, borderWidth: 2, borderRadius: 6, borderColor: appColors.primary },
  checked: { backgroundColor: appColors.primary },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  muted: { marginTop: 5, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  error: { marginTop: 18, color: '#B42336', fontSize: 13 },
  success: { marginTop: 18, color: appColors.primaryDark, fontSize: 13, fontWeight: '700' },
  button: { marginTop: 22, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: appColors.primary },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  section: { marginTop: 28, marginBottom: 12, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  loading: { marginTop: 18 },
  card: { marginBottom: 10, padding: 18, borderRadius: 16, backgroundColor: appColors.surface, borderWidth: 1, borderColor: appColors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  cardTitle: { flex: 1, color: appColors.ink, fontSize: 15, fontWeight: '800' },
  status: { color: appColors.warmInk, fontSize: 11, fontWeight: '700' },
  activeStatus: { color: appColors.primaryDark },
  code: { marginTop: 8, color: appColors.muted, fontSize: 11 },
});
