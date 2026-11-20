import { canAccess, hasEndpoint, type EndpointGrant } from '@/features/auth/permissions';
import { canOpenFeature } from '@/features/navigation/feature-routes';
import type { Session } from '@/features/auth/session';

const detail = { method: 'GET', path: '/api/v1/medical_records/:id' };
const list = { method: 'GET', path: '/api/v1/medical_records/all' };
const sessionFor = (endpoints: EndpointGrant[]): Session => ({
  token: 'test', user: { user_id: 9, full_name: 'Nurse', phone: '0900000000', role_id: 8, base_role: 'doctor' },
  access: { user_id: 9, role_id: 8, base_role: 'doctor', endpoints, routes: [detail, list, ...endpoints] },
});

describe('effective endpoint permissions', () => {
  test('fails closed before permissions load and after they are removed', () => {
    expect(canAccess(null, 'GET', '/medical_records/1')).toBe(false);
    expect(canAccess(sessionFor([]), 'GET', '/medical_records/1')).toBe(false);
  });
  test('matches method, prefix, parameters and query without granting static routes', () => {
    expect(hasEndpoint([detail], 'get', '/medical_records/42?x=1', [detail, list])).toBe(true);
    expect(hasEndpoint([detail], 'GET', '/medical_records/all', [detail, list])).toBe(false);
    expect(hasEndpoint([detail], 'DELETE', '/medical_records/42', [detail, list])).toBe(false);
    expect(hasEndpoint([detail], 'GET', '/medical_records/42/answers', [detail, list])).toBe(false);
  });
  test('opens a custom staff workflow according to grants', () => {
    const nurse = sessionFor([detail, list, { method: 'GET', path: '/api/v1/lab-results/:id' }]);
    expect(canOpenFeature(nurse, 'lab-requests')).toBe(true);
    expect(canOpenFeature(nurse, 'prescriptions')).toBe(false);
    expect(canAccess(nurse, 'POST', '/lab-results')).toBe(false);
    expect(canOpenFeature(sessionFor([{ method: 'GET', path: '/api/v1/rooms' }]), 'clinic-branches')).toBe(true);
  });
});
