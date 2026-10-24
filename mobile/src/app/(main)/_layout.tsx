import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, View } from 'react-native';

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole } from '@/features/navigation/feature-routes';

export default function MainLayout() {
  const session = useAuthenticatedSession();
  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: appColors.canvas }}>
        <ActivityIndicator color={appColors.primary} />
      </View>
    );
  }

  const role = getDemoRole(session.user.role_id);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appColors.primary,
        tabBarInactiveTintColor: appColors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: appColors.surface, borderTopColor: appColors.border },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: role === 'doctor' ? 'Bệnh án chờ' : 'Bệnh án',
          href: role === 'patient' || role === 'doctor' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Theo dõi',
          href: role === 'patient' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'heart.text.square', android: 'monitor_heart', web: 'monitor_heart' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Bệnh nhân',
          href: role === 'doctor' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'person.2', android: 'groups', web: 'groups' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} tintColor={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
