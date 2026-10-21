import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: '#F5FAF8' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F5FAF8' },
          headerTintColor: '#087A55',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Đăng nhập' }} />
        <Stack.Screen name="signup" options={{ title: 'Đăng ký bệnh nhân' }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Hồ sơ của tôi' }} />
        <Stack.Screen name="change-password" options={{ title: 'Đổi mật khẩu' }} />
        <Stack.Screen name="recovery-email" options={{ title: 'Email khôi phục' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Quên mật khẩu' }} />
      </Stack>
    </ThemeProvider>
  );
}
