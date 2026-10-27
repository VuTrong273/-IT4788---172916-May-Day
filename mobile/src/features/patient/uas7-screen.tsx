import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { uas7Api, type Uas7Eligibility, type Uas7Entry, type Uas7Week } from './uas7-api';

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function Uas7Screen({ session }: { session: Session }) {
  const [eligibility, setEligibility] = useState<Uas7Eligibility | null>(null);
  const [entries, setEntries] = useState<Uas7Entry[]>([]);
  const [week, setWeek] = useState<Uas7Week | null>(null);
  const [itch, setItch] = useState<number | null>(null);
  const [wheals, setWheals] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [eligible, history, summary] = await Promise.all([
        uas7Api.eligibility(session), uas7Api.history(session), uas7Api.week(session),
      ]);
      setEligibility(eligible);
      setEntries(history);
      setWeek(summary);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được dữ liệu UAS7.');
    } finally { setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function retry() {
    setLoading(true);
    setError(null);
    void load();
  }

  const scoreDate = today();
  const scoredToday = entries.some((entry) => entry.score_date === scoreDate);

  async function save() {
    if (eligibility?.eligible !== 'true' || itch === null || wheals === null || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await uas7Api.create(session, {
        medical_record_id: eligibility.medical_record_id, score_date: scoreDate,
        iss7: String(itch), hss7: String(wheals), note: note.trim(),
      });
      setSuccess('Đã lưu điểm UAS7 hôm nay.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được điểm UAS7.');
    } finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe} edges={['bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>THEO DÕI SỨC KHỎE</Text>
      <Text style={styles.title}>Chấm điểm UAS7</Text>
      <Text style={styles.subtitle}>Ghi mức ngứa và số lượng mề đay mỗi ngày. Điểm ngày từ 0 đến 6.</Text>
      {loading ? <ActivityIndicator style={styles.loading} color={appColors.primary} /> : null}
      {error ? <View style={styles.card}><Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retry}><Text style={styles.link}>Thử lại</Text></Pressable>
      </View> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      {!loading && eligibility?.eligible === 'false' ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Chưa thể chấm điểm</Text>
        <Text style={styles.body}>Bạn cần có bệnh án ở trạng thái đang khám. Điểm đã ghi trước đây vẫn hiển thị bên dưới.</Text>
      </View> : null}
      {!loading && eligibility?.eligible === 'true' ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Hôm nay · {scoreDate}</Text>
        {scoredToday ? <Text style={styles.body}>Bạn đã chấm điểm hôm nay. Hãy quay lại vào ngày mai.</Text> : <>
          <ScorePicker title="Mức độ ngứa (ISS7)" value={itch} onChange={setItch}
            labels={['Không ngứa', 'Nhẹ', 'Vừa', 'Nhiều']} />
          <ScorePicker title="Số lượng mề đay (HSS7)" value={wheals} onChange={setWheals}
            labels={['Không có', 'Ít', 'Vừa', 'Nhiều']} />
          <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
          <TextInput value={note} onChangeText={setNote} maxLength={500} multiline
            placeholder="Triệu chứng hoặc hoàn cảnh hôm nay" style={styles.input} />
          <Pressable accessibilityRole="button" disabled={itch === null || wheals === null || saving}
            onPress={() => void save()} style={[styles.button, (itch === null || wheals === null || saving) && styles.disabled]}>
            <Text style={styles.buttonText}>{saving ? 'Đang lưu...' : 'Lưu điểm hôm nay'}</Text>
          </Pressable>
        </>}
      </View> : null}
      {!loading && week ? <View style={styles.card}>
        <Text style={styles.cardTitle}>7 ngày gần nhất</Text>
        <Text style={styles.score}>{week.week_score}/42</Text>
        <Text style={styles.body}>{week.severity_label} · Đã chấm {week.completed_days}/7 ngày</Text>
        {Number(week.completed_days) < 7 ? <Text style={styles.hint}>Tuần này chưa đủ 7 ngày dữ liệu.</Text> : null}
      </View> : null}
      {!loading ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Lịch sử chấm điểm</Text>
        {entries.length === 0 ? <Text style={styles.body}>Chưa có lần chấm điểm nào.</Text> : entries.map((entry) =>
          <View key={entry.score_date} style={styles.entry}>
            <Text style={styles.entryTitle}>{entry.score_date} · {entry.daily_score}/6 điểm</Text>
            <Text style={styles.body}>Ngứa {entry.iss7}/3 · Mề đay {entry.hss7}/3</Text>
            {entry.note ? <Text style={styles.hint}>{entry.note}</Text> : null}
          </View>)}
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function ScorePicker({ title, labels, value, onChange }: {
  title: string; labels: string[]; value: number | null; onChange: (value: number) => void;
}) {
  return <View style={styles.picker}>
    <Text style={styles.label}>{title}</Text>
    <View style={styles.options}>{labels.map((label, index) => <Pressable key={index}
      accessibilityRole="radio" accessibilityState={{ selected: value === index }}
      onPress={() => onChange(index)} style={[styles.option, value === index && styles.selected]}>
      <Text style={[styles.optionText, value === index && styles.selectedText]}>{index} · {label}</Text>
    </Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: appColors.canvas },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 48 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  loading: { marginTop: 28 },
  card: { marginTop: 18, padding: 20, borderRadius: 18, backgroundColor: appColors.surface, borderWidth: 1, borderColor: appColors.border },
  cardTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  body: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: '#B42336', fontSize: 14 },
  success: { marginTop: 16, color: appColors.primaryDark, fontWeight: '700' },
  link: { marginTop: 10, color: appColors.primary, fontWeight: '800' },
  picker: { marginTop: 20 },
  label: { marginTop: 16, color: appColors.ink, fontSize: 14, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: appColors.border },
  selected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  optionText: { color: appColors.ink, fontSize: 13 },
  selectedText: { color: appColors.primaryDark, fontWeight: '800' },
  input: { marginTop: 10, minHeight: 70, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: appColors.border, textAlignVertical: 'top', color: appColors.ink },
  button: { marginTop: 20, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: appColors.primary },
  disabled: { opacity: 0.45 },
  buttonText: { color: appColors.surface, fontWeight: '800' },
  score: { marginTop: 14, color: appColors.primaryDark, fontSize: 32, fontWeight: '800' },
  hint: { marginTop: 7, color: appColors.muted, fontSize: 12 },
  entry: { paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: appColors.border },
  entryTitle: { color: appColors.ink, fontSize: 14, fontWeight: '800' },
});
