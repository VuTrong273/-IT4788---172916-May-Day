import {
  apiRequest,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type PatientGender = 'male' | 'female' | 'other';

export type DoctorPatient = {
  user_id: number;
  full_name: string;
  phone: string;
  gender?: PatientGender;
  year_of_birth?: number;
  created_at?: string;
};

export type DoctorPatientSearch = {
  phone?: string;
  full_name?: string;
};

export type CreateDoctorPatient = {
  full_name: string;
  phone: string;
  password: string;
  gender?: PatientGender;
  year_of_birth?: number;
  career?: string;
  ethnic?: string;
  hamlet_address?: string;
  commune_address?: string;
  city_address?: string;
  work_place?: string;
  health_insurance_number?: string;
  health_insurance_validate?: string;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
};

export type CreatedDoctorPatient = DoctorPatient & {
  role_id: number;
};

export function validatePatientSearch(criteria: DoctorPatientSearch): string | null {
  return criteria.phone?.trim() || criteria.full_name?.trim()
    ? null
    : 'Nhập họ tên hoặc số điện thoại để tìm kiếm.';
}

export function validateCreatePatient(input: CreateDoctorPatient): string | null {
  if (!input.full_name.trim()) return 'Vui lòng nhập họ tên bệnh nhân.';
  if (!/^(03|05|07|08|09)\d{8}$/.test(input.phone.trim())) {
    return 'Số điện thoại cần có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.';
  }
  if (input.password.length < 6) return 'Mật khẩu cần có ít nhất 6 ký tự.';
  if (input.year_of_birth !== undefined && !Number.isInteger(input.year_of_birth)) {
    return 'Năm sinh cần là số nguyên.';
  }
  if (
    input.health_insurance_validate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(input.health_insurance_validate)
  ) {
    return 'Hạn thẻ BHYT cần theo định dạng YYYY-MM-DD.';
  }
  return null;
}

export const doctorPatientsApi = {
  async search(session: Session, criteria: DoctorPatientSearch): Promise<DoctorPatient[]> {
    const response = await apiRequest<ApiEnvelope<DoctorPatient[]>>(
      {
        method: 'get',
        url: '/doctor/patients/search',
        params: {
          phone: criteria.phone?.trim() || undefined,
          full_name: criteria.full_name?.trim() || undefined,
        },
      },
      session.token,
    );
    return requireApiCode(response, ['1000'], 'GET /doctor/patients/search').data;
  },

  async create(session: Session, patient: CreateDoctorPatient): Promise<CreatedDoctorPatient> {
    const response = await apiRequest<ApiEnvelope<CreatedDoctorPatient>>(
      {
        method: 'post',
        url: '/doctor/patients',
        data: patient,
      },
      session.token,
    );
    return requireApiCode(response, ['1001'], 'POST /doctor/patients').data;
  },
};
