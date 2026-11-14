import {
  validateCreatePatient,
  validatePatientSearch,
  type CreateDoctorPatient,
} from '@/features/doctor/patients-api';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
  toBeNull(): void;
  toContain(expected: unknown): void;
};

describe('doctor patient request validation', () => {
  const requiredPatient: CreateDoctorPatient = {
    full_name: 'Nguyễn Văn A',
    phone: '0912345678',
    password: 'Abc@1234',
  };

  test('requires at least one supported search criterion', () => {
    expect(validatePatientSearch({ phone: ' ', full_name: '' })).toBe(
      'Nhập họ tên hoặc số điện thoại để tìm kiếm.',
    );
    expect(validatePatientSearch({ full_name: '  Nguyễn  ' })).toBeNull();
    expect(validatePatientSearch({ phone: '0912' })).toBeNull();
  });

  test('validates required patient fields against the create contract', () => {
    expect(validateCreatePatient(requiredPatient)).toBeNull();
    expect(validateCreatePatient({ ...requiredPatient, phone: '0123456789' })).toContain('Số điện thoại');
    expect(validateCreatePatient({ ...requiredPatient, password: '12345' })).toContain('Mật khẩu');
  });

  test('validates optional year and health insurance date fields', () => {
    expect(validateCreatePatient({ ...requiredPatient, year_of_birth: 1995 })).toBeNull();
    expect(validateCreatePatient({ ...requiredPatient, year_of_birth: 1995.5 })).toContain('Năm sinh');
    expect(validateCreatePatient({
      ...requiredPatient,
      health_insurance_validate: '31/12/2027',
    })).toContain('YYYY-MM-DD');
  });
});
