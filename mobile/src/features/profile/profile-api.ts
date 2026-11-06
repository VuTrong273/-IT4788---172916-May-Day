import { apiRequest, ApiRequestError, requireApiCode } from '@/api/client';
import type { Session } from '@/features/auth/session';

export type Profile = {
  user_id: number;
  full_name: string;
  phone: string;
  recovery_email?: string | null;
  role_id: number;
  gender?: 'male' | 'female' | 'other' | null;
  year_of_birth?: number | null;
  career?: string | null;
  ethnic?: string | null;
  hamlet_address?: string | null;
  commune_address?: string | null;
  city_address?: string | null;
  work_place?: string | null;
  health_insurance_number?: string | null;
  health_insurance_validate?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  first_visit?: string | null;
};

export type ProfileChanges = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'gender'
    | 'year_of_birth'
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
  >
>;

type ProfileResponse = {
  code: string;
  message: string;
  data: Profile;
};

export class SessionExpiredError extends ApiRequestError {
  constructor(error: ApiRequestError) {
    super({
      kind: error.kind,
      status: error.status,
      apiCode: error.apiCode,
      operation: error.operation,
      retryable: error.retryable,
      message: 'Phiên đăng nhập đã hết hạn.',
    });
    this.name = 'SessionExpiredError';
  }
}

function profileFailure(error: unknown): Error {
  if (
    error instanceof ApiRequestError &&
    (error.status === 401 ||
      ['3001', '3002', '3003'].includes(error.apiCode ?? ''))
  ) {
    return new SessionExpiredError(error);
  }
  return error instanceof Error
    ? error
    : new Error('Không thể hoàn tất yêu cầu hồ sơ.');
}

export const profileApi = {
  async getProfile(session: Session): Promise<Profile> {
    try {
      const response = await apiRequest<ProfileResponse>(
        { method: 'get', url: '/profile' },
        session.token,
      );
      return requireApiCode(response, ['1000'], 'GET /profile').data;
    } catch (error) {
      throw profileFailure(error);
    }
  },
  async updateProfile(
    session: Session,
    changes: ProfileChanges,
  ): Promise<Profile> {
    if (Object.keys(changes).length === 0) {
      throw new Error('Thay đổi ít nhất một thông tin trước khi lưu.');
    }

    try {
      const response = await apiRequest<ProfileResponse>(
        { method: 'put', url: '/profile', data: changes },
        session.token,
      );
      return requireApiCode(response, ['1000'], 'PUT /profile').data;
    } catch (error) {
      throw profileFailure(error);
    }
  },
};
