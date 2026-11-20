import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSession } from '@/features/auth/session';

export default function EntryScreen() {
  const { password_changed } = useLocalSearchParams<{ password_changed?: string }>();
  useEffect(() => {
    let active = true;
    const signIn = () => router.replace(password_changed === '1'
      ? { pathname: '/login', params: { password_changed: '1' } }
      : '/login');
    getSession().then(session => {
      if (active) { if (session) router.replace('/home'); else signIn(); }
    }).catch(() => { if (active) signIn(); });
    return () => { active = false; };
  }, [password_changed]);
  return <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#15966C" /></SafeAreaView>;
}
