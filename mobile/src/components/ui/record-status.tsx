import { StyleSheet, Text, View } from 'react-native';
import { appColors } from '@/constants/app-theme';
import type { MedicalRecordStatus } from '@/features/doctor/medical-records-api';

export function RecordStatus({ status }: { status: MedicalRecordStatus }) {
  const color = status === 'completed' ? appColors.success : status === 'pending' ? appColors.warmInk : appColors.primary;
  const backgroundColor = status === 'completed' ? appColors.successSoft : status === 'pending' ? appColors.warm : appColors.primarySoft;
  return <View style={[styles.badge, { backgroundColor }]}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.label, { color }]}>{status === 'pending' ? 'Chờ tiếp nhận' : status === 'completed' ? 'Đã hoàn tất' : 'Đang khám'}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '600' },
});
