import { useState, type KeyboardEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/auth-context';
import { roleFromId, roleLabel } from '@/features/auth/auth-types';
import { Icon } from '@/components/ui/icon';
import { navigationItems } from './navigation';

const routeTitles: Record<string, string> = Object.fromEntries(navigationItems.map((item) => [item.path, item.label]));

export function AppShell() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const role = session ? roleFromId(session.user.role_id) : null;
  const items = navigationItems.filter((item) => role && item.roles.includes(role));
  const currentTitle = routeTitles[location.pathname] ?? (location.pathname.endsWith('/profile') ? 'Hồ sơ cá nhân' : 'Chi tiết bệnh án');
  const initials = session?.user.full_name.trim().split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase() || 'MD';

  async function handleSignOut() {
    await signOut().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  function jumpToNavigation(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    const query = jumpQuery.trim().toLocaleLowerCase('vi');
    if (!query) return;
    const match = items.find((item) => item.label.toLocaleLowerCase('vi').includes(query));
    if (match) navigate(match.path);
    setJumpQuery('');
  }

  return (
    <div className="workspace">
      {mobileOpen ? <button className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <NavLink to="/app" className="brand brand--sidebar" onClick={() => setMobileOpen(false)}>
          <span className="brand__mark"><Icon name="mark" size={22} /></span><span>MAY DAY</span>
        </NavLink>
        <div className="sidebar__workspace">
          <div className="workspace-avatar">M</div>
          <div className="sidebar__workspace-copy"><strong>May Day</strong><span>Không gian y tế</span></div>
          <Icon name="chevron" size={15} className="sidebar__workspace-chevron" />
        </div>
        <div className="sidebar__label">MENU CHÍNH</div>
        <nav className="sidebar__nav" aria-label="Điều hướng chính">
          {items.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/app'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}>
              <Icon name={item.icon} size={19} /><span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <NavLink to="/app/profile" className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`} onClick={() => setMobileOpen(false)}><Icon name="settings" size={19} /><span>Cài đặt tài khoản</span></NavLink>
          <div className="sidebar__support"><span className="sidebar__support-icon"><Icon name="shield" size={18} /></span><strong>Phạm vi dữ liệu</strong><p>Danh sách và hồ sơ hiển thị theo quyền được cấp cho tài khoản.</p></div>
          <button className="sidebar__logout" onClick={() => void handleSignOut()}><Icon name="logout" size={18} /><span>Đăng xuất</span></button>
          {session ? <div className="sidebar__identity"><span className="avatar avatar--small">{initials}</span><div><strong>{session.user.full_name}</strong><span>{role ? roleLabel(role) : 'Nhân viên'}</span></div><button title="Đăng xuất" aria-label="Đăng xuất" onClick={() => void handleSignOut()}><Icon name="logout" size={17} /></button></div> : null}
        </div>
      </aside>

      <div className="workspace__main">
        <header className="topbar">
          <button className="icon-button topbar__menu" aria-label="Mở menu" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
          <div className="topbar__crumb"><span>May Day</span><Icon name="chevron" size={14} /><strong>{currentTitle}</strong></div>
          <div className="topbar__actions">
            <div className="topbar__search"><Icon name="search" size={17} /><input aria-label="Đi tới chức năng" placeholder="Đi tới chức năng" value={jumpQuery} onChange={(event) => setJumpQuery(event.target.value)} onKeyDown={jumpToNavigation} /><kbd>↵</kbd></div>
            <button className="icon-button notification-button" aria-label="Thông báo chưa khả dụng" title="Thông báo chưa kết nối API" disabled><Icon name="bell" /></button>
            <div className="topbar__divider" />
            <button className="topbar__profile" onClick={() => navigate('/app/profile')}>
              <span className="avatar">{initials}</span><span className="topbar__profile-copy"><strong>{session?.user.full_name}</strong><small>{role ? roleLabel(role) : ''}</small></span><Icon name="chevron" size={15} />
            </button>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="workspace-footer"><span>© {new Date().getFullYear()} May Day Healthcare</span><span>Không gian làm việc</span></footer>
      </div>
    </div>
  );
}

export function AppLoading() {
  return <div className="app-loading"><span className="brand__mark"><Icon name="mark" /></span><span className="loading-spinner" /></div>;
}
