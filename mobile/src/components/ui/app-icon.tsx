import { SymbolView } from 'expo-symbols';
import { appColors } from '@/constants/app-theme';

const symbols = {
  home: { ios: 'house', android: 'home', web: 'home' },
  records: { ios: 'doc.text', android: 'description', web: 'description' },
  pending: { ios: 'clock', android: 'schedule', web: 'schedule' },
  patients: { ios: 'person.2', android: 'group', web: 'group' },
  templates: { ios: 'list.clipboard', android: 'assignment', web: 'assignment' },
  labs: { ios: 'testtube.2', android: 'science', web: 'science' },
  prescriptions: { ios: 'pills', android: 'medication', web: 'medication' },
  results: { ios: 'chart.bar.doc.horizontal', android: 'lab_profile', web: 'lab_profile' },
  facilities: { ios: 'cross.case', android: 'local_hospital', web: 'local_hospital' },
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  tracking: { ios: 'heart.text.clipboard', android: 'monitor_heart', web: 'monitor_heart' },
  permissions: { ios: 'checkmark.shield', android: 'shield', web: 'shield' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  add: { ios: 'plus', android: 'add', web: 'add' },
} as const;

export type AppIconName = keyof typeof symbols;

const aliases: Record<string, AppIconName> = {
  'in-progress': 'records', 'in-progress-records': 'records', 'pending-records': 'pending',
  'my-medical-records': 'records', 'admin-medical-records': 'records', 'create-medical-record': 'add',
  'my-results': 'results', 'lab-requests': 'labs', 'clinic-branches': 'facilities',
  'admin-users': 'patients', users: 'patients', 'access-control': 'permissions',
  'lesion-tracking': 'tracking', uas7: 'tracking',
};

export function AppIcon({ name, size = 22, color = appColors.primary }: { name: string; size?: number; color?: string }) {
  const key = aliases[name] ?? (name in symbols ? name as AppIconName : 'records');
  return <SymbolView name={symbols[key]} size={size} tintColor={color} style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
