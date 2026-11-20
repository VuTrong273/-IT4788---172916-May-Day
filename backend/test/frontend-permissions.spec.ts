import { hasEndpoint } from '../../web/src/features/auth/permissions.js';
import { canOpenPage } from '../../web/src/components/layout/navigation.js';

describe('web permission routing', () => {
  const detail = { method: 'GET', path: '/api/v1/medical_records/:id' };
  const list = { method: 'GET', path: '/api/v1/medical_records/all' };
  const can = (method: string, path: string) => hasEndpoint([detail], method, path, [detail, list]);
  it('does not mistake a static list route for a granted detail parameter', () => {
    expect(can('GET', '/medical_records/15')).toBe(true);
    expect(can('GET', '/medical_records/all')).toBe(false);
    expect(can('PUT', '/medical_records/15')).toBe(false);
  });
  it('allows direct detail access without granting the list or unrelated screens', () => {
    expect(canOpenPage('/app/records/15', can)).toBe(true);
    expect(canOpenPage('/app/records', can)).toBe(false);
    expect(canOpenPage('/app/users', can)).toBe(false);
    expect(canOpenPage('/app/unknown', can)).toBe(false);
  });
});
