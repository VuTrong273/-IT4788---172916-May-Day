import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { getAuthenticatedRole } from '@/features/auth/roles';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';

import {
  doctorPatientsApi,
  validateCreatePatient,
  validatePatientSearch,
  type CreateDoctorPatient,
  type CreatedDoctorPatient,
  type DoctorPatient,
  type PatientGender,
} from './patients-api';

type PatientDraft = {
  full_name: string;
  phone: string;
  password: string;
  gender: PatientGender | '';
  year_of_birth: string;
  career: string;
  ethnic: string;
  hamlet_address: string;
  commune_address: string;
  city_address: string;
  work_place: string;
  health_insurance_number: string;
  health_insurance_validate: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
};

const EMPTY_DRAFT: PatientDraft = {
  full_name: '',
  phone: '',
  password: '',
  gender: '',
  year_of_birth: '',
  career: '',
  ethnic: '',
  hamlet_address: '',
  commune_address: '',
  city_address: '',
  work_place: '',
  health_insurance_number: '',
  health_insurance_validate: '',
  next_of_kin_name: '',
  next_of_kin_phone: '',
};

type FieldProps = TextInputProps & {
  label: string;
};

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[styles.input, inputProps.multiline && styles.multiline]}
        placeholderTextColor={appColors.muted}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function patientGenderLabel(gender?: PatientGender) {
  if (gender === 'male') return 'Nam';
  if (gender === 'female') return 'Nữ';
  if (gender === 'other') return 'Khác';
  return 'Chưa có thông tin giới tính';
}

function PatientResult({ patient }: { patient: DoctorPatient }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultName}>{patient.full_name}</Text>
      <Text style={styles.resultDetail}>Số điện thoại: {patient.phone}</Text>
      <Text style={styles.resultDetail}>{patientGenderLabel(patient.gender)}</Text>
      {patient.year_of_birth ? (
        <Text style={styles.resultDetail}>Năm sinh: {patient.year_of_birth}</Text>
      ) : null}
      {patient.created_at ? (
        <Text style={styles.resultDate}>
          Tạo hồ sơ: {new Date(patient.created_at).toLocaleDateString('vi-VN')}
        </Text>
      ) : null}
      <Text style={styles.patientId}>Mã bệnh nhân: {patient.user_id}</Text>
    </View>
  );
}

function CreatedPatient({ patient }: { patient: CreatedDoctorPatient }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.successCard}>
      <Text style={styles.successTitle}>Máy chủ đã xác nhận tạo hồ sơ</Text>
      <Text style={styles.resultName}>{patient.full_name}</Text>
      <Text style={styles.resultDetail}>Số điện thoại: {patient.phone}</Text>
      <Text style={styles.resultDetail}>Mã bệnh nhân: {patient.user_id}</Text>
    </View>
  );
}

export function PatientWorkspace() {
  const session = useAuthenticatedSession();
  const role = session ? getAuthenticatedRole(session.user.role_id) : null;
  const [activeSection, setActiveSection] = useState<'search' | 'create'>('search');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [searchResults, setSearchResults] = useState<DoctorPatient[] | null>(null);
  const [submittedCriteria, setSubmittedCriteria] = useState<DoctorPatientSearchDisplay | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_DRAFT);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdPatient, setCreatedPatient] = useState<CreatedDoctorPatient | null>(null);

  if (!session) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (role !== 'doctor') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Không có quyền truy cập</Text>
            <Text style={styles.messageText}>Tìm kiếm và tạo hồ sơ bệnh nhân chỉ dành cho tài khoản bác sĩ.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const updateDraft = <K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) => {
    if (createLoading) return;
    setDraft((current) => ({ ...current, [key]: value }));
    setCreateError(null);
    setCreatedPatient(null);
  };

  const updateSearchCriteria = (field: 'phone' | 'fullName', value: string) => {
    searchSequence.current += 1;
    setSearchLoading(false);
    setSearchResults(null);
    setSubmittedCriteria(null);
    setSearchError(null);
    if (field === 'phone') setPhone(value);
    else setFullName(value);
  };

  const submitSearch = async () => {
    if (searchLoading) return;
    const criteria = { phone: phone.trim(), full_name: fullName.trim() };
    const validation = validatePatientSearch(criteria);
    setSearchError(validation);
    setSearchResults(null);
    setSubmittedCriteria(null);
    if (validation) return;

    const sequence = ++searchSequence.current;
    setSearchLoading(true);
    try {
      const results = await doctorPatientsApi.search(session, criteria);
      if (searchSequence.current !== sequence) return;
      setSearchResults(results);
      setSubmittedCriteria({ phone: criteria.phone, fullName: criteria.full_name });
    } catch (caught) {
      if (searchSequence.current !== sequence) return;
      setSearchError(caught instanceof Error ? caught.message : 'Không thể tìm bệnh nhân lúc này.');
    } finally {
      if (searchSequence.current === sequence) setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    searchSequence.current += 1;
    setPhone('');
    setFullName('');
    setSearchResults(null);
    setSubmittedCriteria(null);
    setSearchError(null);
    setSearchLoading(false);
  };

  const submitCreate = async () => {
    if (createLoading) return;
    const request = createRequest(draft);
    const validation = validateCreatePatient(request);
    setCreateError(validation);
    setCreatedPatient(null);
    if (validation) return;

    setCreateLoading(true);
    try {
      const patient = await doctorPatientsApi.create(session, request);
      setDraft((current) => ({ ...current, password: '' }));
      setCreatedPatient(patient);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : 'Không thể tạo hồ sơ bệnh nhân lúc này.');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreate = () => {
    setDraft(EMPTY_DRAFT);
    setCreateError(null);
    setCreatedPatient(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BỆNH NHÂN / BÁC SĨ</Text>
        <Text style={styles.title}>Tìm hoặc tạo hồ sơ</Text>
        <Text style={styles.subtitle}>
          Tra cứu theo tên hoặc số điện thoại, hoặc tạo hồ sơ cho bệnh nhân đến khám trực tiếp.
        </Text>

        <View accessibilityRole="tablist" style={styles.tabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === 'search' }}
            onPress={() => setActiveSection('search')}
            style={[styles.tab, activeSection === 'search' && styles.activeTab]}>
            <Text style={[styles.tabText, activeSection === 'search' && styles.activeTabText]}>Tìm bệnh nhân</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === 'create' }}
            onPress={() => setActiveSection('create')}
            style={[styles.tab, activeSection === 'create' && styles.activeTab]}>
            <Text style={[styles.tabText, activeSection === 'create' && styles.activeTabText]}>Tạo hồ sơ</Text>
          </Pressable>
        </View>

        {activeSection === 'search' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Điều kiện tìm kiếm</Text>
              <Text style={styles.panelHint}>Nhập ít nhất một thông tin. Tên tìm gần đúng, số điện thoại khớp từ đầu.</Text>
              <Field
                label="Họ tên"
                value={fullName}
                onChangeText={(value) => updateSearchCriteria('fullName', value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={() => void submitSearch()}
              />
              <Field
                label="Số điện thoại"
                value={phone}
                onChangeText={(value) => updateSearchCriteria('phone', value)}
                placeholder="Ví dụ: 0912"
                keyboardType="phone-pad"
                returnKeyType="search"
                onSubmitEditing={() => void submitSearch()}
              />
              <View style={styles.actions}>
                <ActionButton label={searchLoading ? 'Đang tìm…' : 'Tìm kiếm'} onPress={() => void submitSearch()} disabled={searchLoading} />
                <ActionButton label="Xóa điều kiện" onPress={clearSearch} secondary />
              </View>
            </View>
            {searchLoading ? <ActivityIndicator accessibilityLabel="Đang tìm bệnh nhân" color={appColors.primary} style={styles.loading} /> : null}
            {searchError ? (
              <View accessibilityLiveRegion="polite" style={styles.errorCard}>
                <Text style={styles.errorText}>{searchError}</Text>
                {!validatePatientSearch({ phone, full_name: fullName }) ? (
                  <ActionButton label="Thử tìm lại" onPress={() => void submitSearch()} secondary />
                ) : null}
              </View>
            ) : null}
            {searchResults?.length === 0 && submittedCriteria ? (
              <View style={styles.messageCard}>
                <Text style={styles.messageTitle}>Không tìm thấy bệnh nhân</Text>
                <Text style={styles.messageText}>Không có kết quả cho {criteriaLabel(submittedCriteria)}.</Text>
              </View>
            ) : null}
            {searchResults && searchResults.length > 0 ? (
              <View style={styles.results}>
                <Text style={styles.sectionTitle}>Kết quả ({searchResults.length})</Text>
                {searchResults.map((patient) => <PatientResult key={patient.user_id} patient={patient} />)}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Thông tin hồ sơ</Text>
            <Text style={styles.panelHint}>Các trường có dấu * là bắt buộc. Mật khẩu sẽ được chuyển tới API theo hợp đồng; không được hiển thị lại sau khi lưu.</Text>
            <Field label="Họ tên *" value={draft.full_name} onChangeText={(value) => updateDraft('full_name', value)} placeholder="Họ và tên bệnh nhân" autoCapitalize="words" />
            <Field label="Số điện thoại *" value={draft.phone} onChangeText={(value) => updateDraft('phone', value)} placeholder="10 số, ví dụ 0912345678" keyboardType="phone-pad" />
            <Field label="Mật khẩu tạm thời *" value={draft.password} onChangeText={(value) => updateDraft('password', value)} placeholder="Tối thiểu 6 ký tự" secureTextEntry autoCapitalize="none" />

            <Text style={styles.label}>Giới tính</Text>
            <View style={styles.genderOptions}>
              {([
                ['male', 'Nam'],
                ['female', 'Nữ'],
                ['other', 'Khác'],
              ] as const).map(([value, label]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.gender === value }}
                  key={value}
                  onPress={() => updateDraft('gender', value)}
                  style={[styles.genderOption, draft.gender === value && styles.genderOptionSelected]}>
                  <Text style={[styles.genderText, draft.gender === value && styles.genderTextSelected]}>{label}</Text>
                </Pressable>
              ))}
              {draft.gender ? (
                <Pressable accessibilityRole="button" onPress={() => updateDraft('gender', '')} style={styles.clearGender}>
                  <Text style={styles.clearGenderText}>Bỏ chọn</Text>
                </Pressable>
              ) : null}
            </View>

            <Field label="Năm sinh" value={draft.year_of_birth} onChangeText={(value) => updateDraft('year_of_birth', digitsOnly(value, 4))} placeholder="Ví dụ: 1995" keyboardType="number-pad" />
            <Field label="Nghề nghiệp" value={draft.career} onChangeText={(value) => updateDraft('career', value)} placeholder="Nghề nghiệp" />
            <Field label="Dân tộc" value={draft.ethnic} onChangeText={(value) => updateDraft('ethnic', value)} placeholder="Dân tộc" />
            <Field label="Địa chỉ (thôn/xóm/số nhà)" value={draft.hamlet_address} onChangeText={(value) => updateDraft('hamlet_address', value)} placeholder="Địa chỉ chi tiết" />
            <Field label="Xã/phường" value={draft.commune_address} onChangeText={(value) => updateDraft('commune_address', value)} placeholder="Xã hoặc phường" />
            <Field label="Tỉnh/thành phố" value={draft.city_address} onChangeText={(value) => updateDraft('city_address', value)} placeholder="Tỉnh hoặc thành phố" />
            <Field label="Nơi làm việc" value={draft.work_place} onChangeText={(value) => updateDraft('work_place', value)} placeholder="Nơi làm việc" />
            <Field label="Số thẻ bảo hiểm y tế" value={draft.health_insurance_number} onChangeText={(value) => updateDraft('health_insurance_number', value)} placeholder="Số thẻ BHYT" autoCapitalize="characters" />
            <Field label="Hạn thẻ BHYT" value={draft.health_insurance_validate} onChangeText={(value) => updateDraft('health_insurance_validate', value)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            <Field label="Người thân liên hệ" value={draft.next_of_kin_name} onChangeText={(value) => updateDraft('next_of_kin_name', value)} placeholder="Họ tên người thân" />
            <Field label="Số điện thoại người thân" value={draft.next_of_kin_phone} onChangeText={(value) => updateDraft('next_of_kin_phone', value)} placeholder="Số điện thoại" keyboardType="phone-pad" />

            {createError ? (
              <View accessibilityLiveRegion="polite" style={styles.errorCard}>
                <Text style={styles.errorText}>{createError}</Text>
                {createdPatient ? null : <ActionButton label="Thử tạo lại" onPress={() => void submitCreate()} secondary />}
              </View>
            ) : null}
            {createdPatient ? <CreatedPatient patient={createdPatient} /> : null}
            <View style={styles.actions}>
              <ActionButton label={createLoading ? 'Đang lưu…' : 'Tạo hồ sơ bệnh nhân'} onPress={() => void submitCreate()} disabled={createLoading || createdPatient !== null} />
              {createdPatient ? <ActionButton label="Tạo hồ sơ khác" onPress={resetCreate} secondary /> : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type DoctorPatientSearchDisplay = { phone: string; fullName: string };

function createRequest(draft: PatientDraft): CreateDoctorPatient {
  const value: CreateDoctorPatient = {
    full_name: draft.full_name.trim(),
    phone: draft.phone.trim(),
    password: draft.password,
  };
  if (draft.gender) value.gender = draft.gender;
  if (draft.year_of_birth.trim()) value.year_of_birth = Number(draft.year_of_birth);
  const optionalFields: (keyof Pick<
    PatientDraft,
    | 'career'
    | 'ethnic'
    | 'hamlet_address'
    | 'commune_address'
    | 'city_address'
    | 'work_place'
    | 'health_insurance_number'
    | 'health_insurance_validate'
    | 'next_of_kin_name'
    | 'next_of_kin_phone'
  >)[] = [
    'career',
    'ethnic',
    'hamlet_address',
    'commune_address',
    'city_address',
    'work_place',
    'health_insurance_number',
    'health_insurance_validate',
    'next_of_kin_name',
    'next_of_kin_phone',
  ];
  for (const key of optionalFields) {
    const fieldValue = draft[key].trim();
    if (fieldValue) value[key] = fieldValue;
  }
  return value;
}

function digitsOnly(value: string, maximumLength: number) {
  return value.replace(/\D/g, '').slice(0, maximumLength);
}

function criteriaLabel(criteria: DoctorPatientSearchDisplay) {
  const values = [];
  if (criteria.fullName) values.push(`tên “${criteria.fullName}”`);
  if (criteria.phone) values.push(`số điện thoại bắt đầu bằng “${criteria.phone}”`);
  return values.join(' và ');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 11, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 23, padding: 5, borderRadius: 14, backgroundColor: '#E1EAF2' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 43, borderRadius: 10, paddingHorizontal: 8 },
  activeTab: { backgroundColor: appColors.surface },
  tabText: { color: appColors.muted, fontSize: 13, fontWeight: '700' },
  activeTabText: { color: appColors.primaryDark },
  panel: { marginTop: 16, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  panelTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  panelHint: { marginTop: 6, marginBottom: 17, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  field: { marginBottom: 14 },
  label: { marginBottom: 6, color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, color: appColors.ink, backgroundColor: appColors.surface, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: appColors.primary, paddingHorizontal: 17 },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  secondaryButton: { backgroundColor: appColors.primarySoft },
  secondaryButtonText: { color: appColors.primaryDark },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.78 },
  loading: { marginTop: 24 },
  errorCard: { marginTop: 15, padding: 16, borderRadius: 13, borderWidth: 1, borderColor: '#F2C5CA', backgroundColor: '#FFF5F5', gap: 10 },
  errorText: { color: '#A61B29', fontSize: 14, lineHeight: 20 },
  messageCard: { marginTop: 15, padding: 20, borderRadius: 16, backgroundColor: appColors.surface },
  messageTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  messageText: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  results: { marginTop: 24, gap: 10 },
  sectionTitle: { marginBottom: 3, color: appColors.ink, fontSize: 17, fontWeight: '800' },
  resultCard: { padding: 17, borderWidth: 1, borderColor: appColors.border, borderRadius: 15, backgroundColor: appColors.surface },
  resultName: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  resultDetail: { marginTop: 6, color: appColors.muted, fontSize: 13, lineHeight: 18 },
  resultDate: { marginTop: 9, color: appColors.primaryDark, fontSize: 12, fontWeight: '700' },
  patientId: { marginTop: 11, color: appColors.primary, fontSize: 12, fontWeight: '800' },
  successCard: { marginTop: 17, padding: 17, borderWidth: 1, borderColor: '#A7D7BD', borderRadius: 15, backgroundColor: '#F1FBF5' },
  successTitle: { marginBottom: 10, color: '#176B3A', fontSize: 14, fontWeight: '800' },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 },
  genderOption: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 10, paddingHorizontal: 14 },
  genderOptionSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  genderText: { color: appColors.muted, fontSize: 13, fontWeight: '700' },
  genderTextSelected: { color: appColors.primaryDark },
  clearGender: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  clearGenderText: { color: appColors.primary, fontSize: 12, fontWeight: '700' },
});
