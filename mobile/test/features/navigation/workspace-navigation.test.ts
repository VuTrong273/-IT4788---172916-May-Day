import {
  getWorkspaceNavigation,
  getWorkspacePageTitle,
  isAnyNavigationItemActive,
  isNavigationItemActive,
  splitMobileNavigation,
} from '@/features/navigation/workspace-navigation';
import { getFeatureRoute } from '@/features/navigation/feature-routes';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toContain(expected: unknown): void;
  toHaveLength(expected: number): void;
  toBe(expected: unknown): void;
};

describe('role-aware workspace navigation', () => {
  test('returns only the authenticated role destinations and never falls back for unknown roles', () => {
    expect(getWorkspaceNavigation('patient').map((item) => item.id)).toEqual([
      'home', 'records', 'tracking', 'results', 'templates', 'account',
    ]);
    expect(getWorkspaceNavigation('doctor').map((item) => item.id)).toContain('pending');
    expect(getWorkspaceNavigation('doctor').map((item) => item.id)).toContain('labs');
    expect(getWorkspaceNavigation('admin').map((item) => item.id)).toContain('permissions');
    expect(getWorkspaceNavigation('admin').map((item) => item.id)).toContain('records');
    expect(getWorkspaceNavigation(null)).toEqual([]);
    expect(getFeatureRoute('templates')?.roles).toEqual(['patient', 'doctor', 'admin']);
    expect(getFeatureRoute('create-medical-record')?.roles).toEqual(['doctor', 'patient']);
    expect(getFeatureRoute('admin-medical-records')?.roles).toEqual(['admin']);
  });

  test('keeps phone navigation to four destinations plus an overflow entry', () => {
    const adminNavigation = getWorkspaceNavigation('admin');
    const mobile = splitMobileNavigation(adminNavigation);

    expect(mobile.needsMore).toBe(true);
    expect(mobile.primary).toHaveLength(4);
    expect(mobile.overflow.map((item) => item.id)).toEqual(['templates', 'permissions', 'account']);
  });

  test('recognizes nested destinations and account routes without treating sibling routes as active', () => {
    const items = getWorkspaceNavigation('doctor');
    const pending = items.find((item) => item.id === 'pending');
    const account = items.find((item) => item.id === 'account');

    expect(pending && isNavigationItemActive('/feature/pending-records/42', pending)).toBe(true);
    expect(account && isNavigationItemActive('/change-password', account)).toBe(true);
    expect(isAnyNavigationItemActive('/feature/unknown', items)).toBe(false);
    expect(getWorkspacePageTitle('/feature/in-progress-records', items)).toBe('Đang khám');
  });

  test('exposes clinic references to doctors while keeping admin management role-specific', () => {
    const clinicRoute = getFeatureRoute('clinic-branches');
    expect(clinicRoute?.roles).toEqual(['doctor', 'admin']);
    expect(getWorkspaceNavigation('doctor').map((item) => item.id)).toContain('facilities');
    expect(getWorkspaceNavigation('patient').map((item) => item.id).includes('facilities')).toBe(false);
  });
});
