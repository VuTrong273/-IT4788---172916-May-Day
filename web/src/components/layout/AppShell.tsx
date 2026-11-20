import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useAuth } from "@/features/auth/auth-context";
import { roleFromId, roleLabel } from "@/features/auth/auth-types";
import { Icon } from "@/components/ui/icon";
import { navigationItems, canOpenPage } from "./navigation";

const routeTitles: Record<string, string> = Object.fromEntries(
  navigationItems.map((item) => [item.path, item.label]),
);

export function AppShell() {
  const { session, signOut, can, accessReady, accessError, refreshAccess } =
    useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactScreen, setCompactScreen] = useState(
    () => window.matchMedia("(max-width: 992px)").matches,
  );
  const [jumpQuery, setJumpQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const role = session ? roleFromId(session.user) : null;
  const items = navigationItems.filter((item) => canOpenPage(item.path, can));
  const currentTitle =
    routeTitles[location.pathname] ??
    (location.pathname.endsWith("/profile/password")
      ? "Đổi mật khẩu"
      : location.pathname.endsWith("/profile")
        ? "Thông tin cá nhân"
        : "Chi tiết bệnh án");
  const initials =
    session?.user.full_name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "MD";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setAccountOpen(false);
    await signOut().catch(() => undefined);
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 992px)");
    const resize = () => {
      setCompactScreen(media.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    accountRef.current
      ?.querySelector<HTMLButtonElement>(".account-menu button")
      ?.focus();
    function outside(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);

  function jumpToNavigation(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const query = jumpQuery.trim().toLocaleLowerCase("vi");
    if (!query) return;
    const match = items.find((item) =>
      item.label.toLocaleLowerCase("vi").includes(query),
    );
    if (match) navigate(match.path);
    setJumpQuery("");
  }

  return (
    <div
      className={`workspace${location.pathname.startsWith("/app/profile") ? " workspace--profile" : ""}${location.pathname === "/app/users" ? " workspace--users" : ""}${location.pathname === "/app/access" ? " workspace--access" : ""}`}
    >
      {compactScreen && mobileOpen ? (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        id="workspace-sidebar"
        className={`sidebar${mobileOpen ? " sidebar--open" : ""}${sidebarCollapsed && !compactScreen ? " sidebar--collapsed" : ""}`}
      >
        <Link
          to="/app"
          className="sidebar__brand"
          aria-label="May Day - Tổng quan"
        >
          <span className="sidebar__brand-mark">
            <Icon name="mark" size={23} />
          </span>
          <span className="sidebar__brand-copy">
            <strong>May Day</strong>
            <small>Cổng quản lý y tế</small>
          </span>
        </Link>
        <div className="sidebar__label">MENU CHÍNH</div>
        <nav className="sidebar__nav" aria-label="Điều hướng chính">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              aria-label={item.label}
              end={item.path === "/app"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-item${isActive ? " nav-item--active" : ""}`
              }
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <div className="sidebar__support">
            <span className="sidebar__support-icon">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <strong>Truy cập theo phân quyền</strong>
              <p>Chỉ hiển thị dữ liệu được cấp phép.</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace__main">
        <header className="topbar">
          <button
            className="icon-button topbar__menu"
            aria-label={
              compactScreen
                ? "Mở menu"
                : sidebarCollapsed
                  ? "Mở rộng thanh điều hướng"
                  : "Thu gọn thanh điều hướng"
            }
            title={
              sidebarCollapsed && !compactScreen
                ? "Mở rộng thanh điều hướng"
                : "Thu gọn / mở menu"
            }
            aria-controls="workspace-sidebar"
            aria-expanded={compactScreen ? mobileOpen : !sidebarCollapsed}
            onClick={() =>
              compactScreen
                ? setMobileOpen((open) => !open)
                : setSidebarCollapsed((collapsed) => !collapsed)
            }
          >
            <Icon name="menu" />
          </button>
          <div className="topbar__crumb">
            <span>May Day</span>
            <Icon name="chevron" size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar__actions">
            <div className="topbar__search">
              <Icon name="search" size={17} />
              <input
                aria-label="Đi tới chức năng"
                placeholder="Đi tới chức năng"
                value={jumpQuery}
                onChange={(event) => setJumpQuery(event.target.value)}
                onKeyDown={jumpToNavigation}
              />
              <kbd>↵</kbd>
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Thông báo chưa khả dụng"
              title="Thông báo chưa kết nối API"
              disabled
            >
              <Icon name="bell" />
            </button>
            <div className="topbar__divider" />
            <div className="account-dropdown" ref={accountRef}>
              <button
                ref={accountButtonRef}
                className="topbar__profile"
                aria-label="Mở menu tài khoản"
                aria-expanded={accountOpen}
                aria-controls="account-menu"
                disabled={signingOut}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="avatar">{initials}</span>
                <span className="topbar__profile-copy">
                  <strong>{session?.user.full_name}</strong>
                  <small>{role ? roleLabel(role) : ""}</small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
              {accountOpen ? (
                <div id="account-menu" className="account-menu">
                  {can("GET", "/profile") ? (
                    <button
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("/app/profile");
                      }}
                    >
                      <Icon name="user" size={18} />
                      Thông tin cá nhân
                    </button>
                  ) : null}
                  <button
                    className="account-menu__logout"
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                  >
                    <Icon name="logout" size={18} />
                    {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="page-content">
          {!accessReady ? (
            accessError ? (
              <div role="alert">
                <p>{accessError}</p>
                <button onClick={() => void refreshAccess()}>
                  Tải lại quyền truy cập
                </button>
              </div>
            ) : (
              <p role="status">Đang tải quyền truy cập…</p>
            )
          ) : canOpenPage(location.pathname, can) ? (
            <Outlet />
          ) : (
            <div role="alert">
              Bạn chưa được cấp quyền sử dụng chức năng này.
            </div>
          )}
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} May Day Healthcare</span>
          <span>Không gian làm việc</span>
        </footer>
      </div>
    </div>
  );
}

export function AppLoading() {
  return (
    <div className="app-loading">
      <span className="brand__mark">
        <Icon name="mark" />
      </span>
      <span className="loading-spinner" />
    </div>
  );
}
