import {
  isValidSession,
  parseSession,
  type Session,
} from '@/features/auth/session.shared';

const validSession: Session = {
  token: 'server-issued-token',
  user: {
    user_id: 14,
    full_name: 'Nguyễn Văn A',
    phone: '0912345678',
    role_id: 3,
  },
};

describe('platform-neutral session validation', () => {
  test('accepts a server identity with a known role', () => {
    expect(isValidSession(validSession)).toBe(true);
    expect(parseSession(JSON.stringify(validSession))).toEqual(validSession);
  });

  test('rejects unknown roles, demo tokens, and malformed stored data', () => {
    expect(
      isValidSession({
        ...validSession,
        user: { ...validSession.user, role_id: 42 },
      }),
    ).toBe(false);
    expect(
      isValidSession({ ...validSession, token: 'demo-token' }),
    ).toBe(false);
    expect(parseSession('{broken')).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
});
