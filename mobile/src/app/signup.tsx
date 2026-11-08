
import { useState } from 'react';
import { router } from 'expo-router';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi } from '@/features/auth/auth-api';
import { styles } from '@/features/auth/login-styles';

const phonePattern = /^(03|05|07|08|09)[0-9]{8}$/;

const genderOptions = [
  { value: null, label: 'Không chọn' },
  { value: 'male' as const, label: 'Nam' },
  { value: 'female' as const, label: 'Nữ' },
  { value: 'other' as const, label: 'Khác' },
];

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<
    'male' | 'female' | 'other' | null
  >(null);
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { width } = useWindowDimensions();
  const showHospitalInfo = width >= 850;

  async function handleSignup() {
    if (isSubmitting) return;

    const name = fullName.trim();

    if (!name) {
      setErrorMessage('Vui lòng nhập họ tên.');
      return;
    }

    if (!phonePattern.test(phone)) {
      setErrorMessage(
        'Số điện thoại phải có 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.',
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Hai mật khẩu không khớp.');
      return;
    }

    if (
      yearOfBirth &&
      (!/^\d{4}$/.test(yearOfBirth) ||
        Number(yearOfBirth) < 1900 ||
        Number(yearOfBirth) > 2100)
    ) {
      setErrorMessage('Năm sinh phải từ 1900 đến 2100.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await authApi.signup({
        full_name: name,
        phone,
        password,
        ...(gender ? { gender } : {}),
        ...(yearOfBirth
          ? { year_of_birth: Number(yearOfBirth) }
          : {}),
      });

      router.replace('/login?role=patient&registered=1');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Đăng ký thất bại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Background giống màn hình đăng nhập */}
      <View style={styles.authRoot}>
        <Image
          source={require('../../assets/images/login-background.jpg')}
          style={styles.background}
          resizeMode="cover"
        />

        <View style={styles.backgroundOverlay} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header: Mobile chỉ hiển thị MAYDAY */}
            <View style={styles.header}>
              {/* Logo MAYDAY */}
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>+</Text>
                </View>

                <View>
                  <Text style={styles.brandName}>MAYDAY</Text>
                  <Text style={styles.brandDescription}>
                    Clinical AI Care
                  </Text>
                </View>
              </View>

              {/* Thông tin bệnh viện: chỉ hiện khi đủ chiều rộng */}
              {showHospitalInfo && (
                <View style={styles.hospitalHeader}>
                  <View style={styles.hospitalNameRow}>
                    <Text style={styles.hospitalPlus}>+</Text>
                    <Text
                      style={styles.hospitalName}
                      numberOfLines={1}
                    >
                      BỆNH VIỆN DA LIỄU TRUNG ƯƠNG
                    </Text>
                  </View>

                  <Text
                    style={styles.hospitalEnglish}
                    numberOfLines={1}
                  >
                    NATIONAL HOSPITAL OF DERMATOLOGY AND VENEREOLOGY
                  </Text>

                  <Text
                    style={styles.hospitalSubtitle}
                    numberOfLines={1}
                  >
                    HỆ THỐNG QUẢN LÝ VÀ THEO DÕI ĐIỀU TRỊ BỆNH MÀY ĐAY (MAYDAY)
                  </Text>
                </View>
              )}

              {/* Badge */}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  CỔNG BỆNH NHÂN
                </Text>
              </View>
            </View>

            <View style={styles.headerDivider} />

            {/* Signup card */}
            <View style={styles.loginCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.title}>ĐĂNG KÝ</Text>
                <Text style={styles.subtitle}>
                  Tạo tài khoản để sử dụng hệ thống MayDay
                </Text>
              </View>

              <View style={styles.authForm}>
                {/* Họ và tên */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>Họ và tên</Text>
                  <TextInput
                    autoCapitalize="words"
                    autoComplete="name"
                    onChangeText={setFullName}
                    placeholder="Nhập họ và tên"
                    placeholderTextColor="#8299A9"
                    style={styles.authInput}
                    value={fullName}
                  />
                </View>

                {/* Số điện thoại */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>Số điện thoại</Text>
                  <TextInput
                    autoComplete="tel"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onChangeText={setPhone}
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#8299A9"
                    style={styles.authInput}
                    value={phone}
                  />
                </View>

                {/* Giới tính */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>
                    Giới tính (không bắt buộc)
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {genderOptions.map((option) => {
                      const selected = gender === option.value;

                      return (
                        <Pressable
                          key={option.label}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setGender(option.value)}
                          style={{
                            minHeight: 42,
                            paddingHorizontal: 15,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: selected ? '#168ACB' : '#D9EAF4',
                            borderRadius: 10,
                            backgroundColor: selected ? '#E7F3FA' : '#FFFFFF',
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? '#168ACB' : '#71899A',
                              fontSize: 14,
                              fontWeight: '700',
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Năm sinh */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>
                    Năm sinh (không bắt buộc)
                  </Text>
                  <TextInput
                    accessibilityLabel="Năm sinh"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={setYearOfBirth}
                    placeholder="YYYY"
                    placeholderTextColor="#8299A9"
                    style={styles.authInput}
                    value={yearOfBirth}
                  />
                </View>

                {/* Mật khẩu */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>Mật khẩu</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setPassword}
                    placeholder="Ít nhất 6 ký tự"
                    placeholderTextColor="#8299A9"
                    secureTextEntry
                    style={styles.authInput}
                    value={password}
                  />
                </View>

                {/* Nhập lại mật khẩu */}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>
                    Nhập lại mật khẩu
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setConfirmPassword}
                    placeholder="Nhập lại mật khẩu"
                    placeholderTextColor="#8299A9"
                    secureTextEntry
                    style={styles.authInput}
                    value={confirmPassword}
                  />
                </View>

                {errorMessage ? (
                  <View style={[styles.messageBox, styles.errorBox]}>
                    <Text style={[styles.messageText, styles.errorMessage]}>
                      {errorMessage}
                    </Text>
                  </View>
                ) : null}

                {/* Nút đăng ký */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitting }}
                  disabled={isSubmitting}
                  onPress={() => void handleSignup()}
                  style={[
                    styles.authPrimaryButton,
                    isSubmitting && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.authPrimaryButtonText}>
                    {isSubmitting ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ'}
                  </Text>
                </Pressable>

                {/* Quay lại đăng nhập */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/login?role=patient')}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>
                    ← Quay lại đăng nhập
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>© 2026 MAYDAY</Text>
              <Text style={styles.footerSubtext}>
                CLINICAL AI CARE
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
