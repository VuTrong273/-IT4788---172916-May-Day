import type { UserRole } from '@/features/auth/roles';
import type { Session } from '@/features/auth/session';
import { canOpenFeature } from './feature-routes';
import { canAccess } from '@/features/auth/permissions';

export type WorkspaceNavigationItem = {
  id: string;
  label: string;
  href: string;
  glyph: string;
  group: string;
};

const navigationByRole: Record<UserRole, WorkspaceNavigationItem[]> = {
  patient: [
    { id: 'home', label: 'Tổng quan', href: '/home', glyph: '⌂', group: 'CHĂM SÓC' },
    { id: 'records', label: 'Bệnh án', href: '/records', glyph: '▤', group: 'CHĂM SÓC' },
    { id: 'tracking', label: 'Theo dõi', href: '/tracking', glyph: '♡', group: 'CHĂM SÓC' },
    { id: 'results', label: 'Kết quả', href: '/feature/my-results', glyph: '◉', group: 'CHĂM SÓC' },
    { id: 'templates', label: 'Mẫu phiếu', href: '/feature/templates', glyph: '▧', group: 'CHĂM SÓC' },
    { id: 'account', label: 'Thông tin cá nhân', href: '/account', glyph: '◎', group: 'TÀI KHOẢN' },
  ],
  doctor: [
    { id: 'home', label: 'Tổng quan', href: '/home', glyph: '⌂', group: 'KHÁM BỆNH' },
    { id: 'pending', label: 'Bệnh án chờ', href: '/feature/pending-records', glyph: '◷', group: 'KHÁM BỆNH' },
    { id: 'in-progress', label: 'Đang khám', href: '/feature/in-progress-records', glyph: '▤', group: 'KHÁM BỆNH' },
    { id: 'patients', label: 'Bệnh nhân', href: '/patients', glyph: '♙', group: 'KHÁM BỆNH' },
    { id: 'templates', label: 'Mẫu phiếu', href: '/feature/templates', glyph: '▧', group: 'LÂM SÀNG' },
    { id: 'labs', label: 'Xét nghiệm', href: '/feature/lab-requests', glyph: '⚕', group: 'LÂM SÀNG' },
    { id: 'prescriptions', label: 'Đơn thuốc', href: '/feature/prescriptions', glyph: '＋', group: 'LÂM SÀNG' },
    { id: 'facilities', label: 'Cơ sở khám', href: '/feature/clinic-branches', glyph: '⌖', group: 'THÔNG TIN' },
    { id: 'account', label: 'Thông tin cá nhân', href: '/account', glyph: '◎', group: 'TÀI KHOẢN' },
  ],
  admin: [
    { id: 'home', label: 'Tổng quan', href: '/home', glyph: '⌂', group: 'QUẢN TRỊ' },
    { id: 'records', label: 'Bệnh án', href: '/feature/admin-medical-records', glyph: '▤', group: 'QUẢN TRỊ' },
    { id: 'users', label: 'Người dùng', href: '/feature/admin-users', glyph: '♙', group: 'QUẢN TRỊ' },
    { id: 'facilities', label: 'Cơ sở khám', href: '/feature/clinic-branches', glyph: '⌖', group: 'QUẢN TRỊ' },
    { id: 'templates', label: 'Mẫu phiếu', href: '/feature/templates', glyph: '▧', group: 'CẤU HÌNH' },
    { id: 'permissions', label: 'Phân quyền', href: '/feature/access-control', glyph: '◈', group: 'CẤU HÌNH' },
    { id: 'account', label: 'Thông tin cá nhân', href: '/account', glyph: '◎', group: 'TÀI KHOẢN' },
  ],
};

export function getWorkspaceNavigation(role: UserRole | null, session?: Session): WorkspaceNavigationItem[] {
  const preferred = role ? navigationByRole[role] : [];
  const items = session && role && role !== 'patient' ? [...new Map([...preferred, ...Object.values(navigationByRole).flat().filter(item => item.href.startsWith('/feature/'))].map(item => [item.href,item])).values()] : preferred;
  if (!session) return items;
  return items.filter(item => {
    if (item.href.startsWith('/feature/')) return canOpenFeature(session, item.href.slice('/feature/'.length));
    if (item.href === '/patients') return canOpenFeature(session, 'patients');
    if (item.href === '/records') return canOpenFeature(session, 'my-medical-records');
    if (item.href === '/tracking') return canOpenFeature(session,'lesion-tracking') || canOpenFeature(session,'uas7') || canOpenFeature(session,'my-results');
    return true;
  });
}

export function canOpenMobilePage(session: Session, pathname: string): boolean {
  if (pathname.startsWith('/feature/')) return canOpenFeature(session,pathname.slice('/feature/'.length));
  if (pathname.startsWith('/medical-records/')) return canAccess(session,'GET',pathname.replace('/medical-records/','/medical_records/'));
  if (pathname === '/patients') return canOpenFeature(session,'patients');
  if (pathname === '/records') return canOpenFeature(session,'my-medical-records');
  if (pathname === '/profile') return canAccess(session,'GET','/profile');
  if (pathname === '/recovery-email') return canAccess(session,'POST','/auth/recovery-email') && canAccess(session,'POST','/auth/recovery-email/verify');
  if (pathname === '/change-password') return canAccess(session,'PUT','/auth/change-password');
  return ['/home','/account','/tracking','/explore','/dashboard'].includes(pathname);
}

export function splitMobileNavigation(items: WorkspaceNavigationItem[]) {
  const needsMore = items.length > 4;
  return {
    primary: needsMore ? items.slice(0, 4) : items,
    overflow: needsMore ? items.slice(4) : [],
    needsMore,
  };
}

export function isNavigationItemActive(pathname: string, item: WorkspaceNavigationItem): boolean {
  if (item.id === 'account' && ['/account', '/profile', '/change-password', '/recovery-email'].includes(pathname)) {
    return true;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isAnyNavigationItemActive(
  pathname: string,
  items: WorkspaceNavigationItem[],
): boolean {
  return items.some((item) => isNavigationItemActive(pathname, item));
}

export function getWorkspacePageTitle(pathname: string, items: WorkspaceNavigationItem[]): string {
  const item = items.find((candidate) => isNavigationItemActive(pathname, candidate));
  if (item) return item.label;
  if (pathname.startsWith('/medical-records/')) return 'Chi tiết bệnh án';
  if (pathname === '/profile') return 'Hồ sơ cá nhân';
  return 'Không gian làm việc';
}
