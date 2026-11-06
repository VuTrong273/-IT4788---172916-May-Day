import { useMemo, useState, type ReactNode } from 'react';
import { router, usePathname, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { roleLabels, type UserRole } from '@/features/auth/roles';
import { clearAuthenticatedSession } from '@/features/auth/sign-out';
import type { Session } from '@/features/auth/session';
import {
  getWorkspaceNavigation,
  getWorkspacePageTitle,
  isAnyNavigationItemActive,
  isNavigationItemActive,
  splitMobileNavigation,
  type WorkspaceNavigationItem,
} from '@/features/navigation/workspace-navigation';

type Props = {
  session: Session;
  role: UserRole | null;
  children: ReactNode;
};

const TABLET_BREAKPOINT = 600;
const DESKTOP_BREAKPOINT = 1024;

export function WorkspaceShell({ session, role, children }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const items = useMemo(() => getWorkspaceNavigation(role), [role]);
  const mobileNavigation = useMemo(() => splitMobileNavigation(items), [items]);
  const wide = width >= DESKTOP_BREAKPOINT;
  const tablet = width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT;
  const title = getWorkspacePageTitle(pathname, items);
  const initials = session.user.full_name.trim().split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase() || 'MD';

  function navigateTo(item: WorkspaceNavigationItem) {
    setDrawerOpen(false);
    setMoreOpen(false);
    if (pathname !== item.href) router.push(item.href as Href);
  }

  function jumpToDestination() {
    const query = jumpQuery.trim().toLocaleLowerCase('vi');
    const match = items.find((item) => item.label.toLocaleLowerCase('vi').includes(query));
    if (match) navigateTo(match);
    setJumpQuery('');
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const serverConfirmed = await clearAuthenticatedSession(session);
      router.dismissTo('/');
      if (!serverConfirmed) {
        Alert.alert('Đã đăng xuất trên thiết bị', 'Máy chủ chưa xác nhận hủy phiên. Hãy kiểm tra kết nối mạng.');
      }
    } catch {
      Alert.alert('Không thể đăng xuất', 'Không thể xóa phiên đăng nhập trên thiết bị. Vui lòng thử lại.');
      setSigningOut(false);
    }
  }

  if (!role) {
    return (
      <SafeAreaView style={styles.restrictedRoot} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.restrictedCard}>
          <Text style={styles.eyebrow}>MAY DAY / BẢO MẬT</Text>
          <Text style={styles.restrictedTitle}>Không thể xác định quyền truy cập</Text>
          <Text style={styles.bodyText}>Vai trò của tài khoản không được hỗ trợ. Hãy đăng xuất và xác thực lại.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut }}
            disabled={signingOut}
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeRoot} edges={wide ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      <View style={styles.workspace}>
        {wide ? (
          <Sidebar
            items={items}
            pathname={pathname}
            fullName={session.user.full_name}
            role={role}
            onNavigate={navigateTo}
            onSignOut={() => void signOut()}
            signingOut={signingOut}
          />
        ) : null}
        <View style={styles.main}>
          <View style={[styles.topbar, !wide && styles.topbarCompact]}>
            {tablet ? (
              <Pressable
                accessibilityLabel="Mở điều hướng"
                accessibilityRole="button"
                accessibilityState={{ expanded: drawerOpen }}
                onPress={() => setDrawerOpen(true)}
                style={styles.headerIconButton}>
                <Text style={styles.headerGlyph}>☰</Text>
              </Pressable>
            ) : null}
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbBrand}>May Day</Text>
              <Text accessibilityElementsHidden style={styles.breadcrumbDivider}>›</Text>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.breadcrumbTitle}>{title}</Text>
            </View>
            {width >= TABLET_BREAKPOINT ? (
              <View style={styles.jumpSearch}>
                <Text accessibilityElementsHidden style={styles.searchGlyph}>⌕</Text>
                <TextInput
                  accessibilityLabel="Đi tới chức năng"
                  placeholder="Đi tới chức năng"
                  placeholderTextColor={appColors.muted}
                  returnKeyType="search"
                  value={jumpQuery}
                  onChangeText={setJumpQuery}
                  onSubmitEditing={jumpToDestination}
                  style={styles.searchInput}
                />
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={`Hồ sơ ${session.user.full_name}`}
              accessibilityRole="button"
              onPress={() => router.push('/account')}
              style={styles.profileButton}>
              <Text style={styles.avatar}>{initials}</Text>
              {wide ? (
                <View style={styles.profileCopy}>
                  <Text numberOfLines={1} style={styles.profileName}>{session.user.full_name}</Text>
                  <Text style={styles.profileRole}>{roleLabels[role]}</Text>
                </View>
              ) : null}
              {wide ? <Text style={styles.profileChevron}>⌄</Text> : null}
            </Pressable>
          </View>

          <View style={styles.page}>{children}</View>
          {wide ? (
            <View style={styles.workspaceFooter}>
              <Text style={styles.footerText}>© {new Date().getFullYear()} May Day Healthcare</Text>
              <Text style={styles.footerText}>Không gian làm việc</Text>
            </View>
          ) : null}
          {!wide && !tablet ? (
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
              {mobileNavigation.primary.map((item) => (
                <NavigationButton
                  key={item.id}
                  item={item}
                  active={isNavigationItemActive(pathname, item)}
                  compact
                  onPress={() => navigateTo(item)}
                />
              ))}
              {mobileNavigation.needsMore ? (
                <Pressable
                  accessibilityLabel="Thêm chức năng"
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: moreOpen || isAnyNavigationItemActive(pathname, mobileNavigation.overflow),
                    expanded: moreOpen,
                  }}
                  onPress={() => setMoreOpen(true)}
                  style={({ pressed }) => [styles.bottomItem, pressed && styles.pressed]}>
                  <Text style={styles.bottomGlyph}>•••</Text>
                  <Text style={styles.bottomLabel}>Thêm</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
        transparent
        visible={drawerOpen}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Đóng điều hướng"
            accessibilityRole="button"
            onPress={() => setDrawerOpen(false)}
            style={styles.modalBackdrop}
          />
          <View style={[styles.drawer, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
            <NavigationPanel
              items={items}
              pathname={pathname}
              fullName={session.user.full_name}
              role={role}
              onNavigate={navigateTo}
              onSignOut={() => void signOut()}
              signingOut={signingOut}
              onClose={() => setDrawerOpen(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setMoreOpen(false)}
        transparent
        visible={moreOpen}>
        <View style={[styles.sheetRoot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityLabel="Đóng danh sách chức năng"
            accessibilityRole="button"
            onPress={() => setMoreOpen(false)}
            style={styles.modalBackdrop}
          />
          <View accessibilityViewIsModal style={styles.moreSheet}>
            <View style={styles.sheetHeading}>
              <View>
                <Text accessibilityRole="header" style={styles.sheetTitle}>Thêm chức năng</Text>
                <Text style={styles.sheetSubtitle}>{roleLabels[role]}</Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng danh sách chức năng"
                accessibilityRole="button"
                onPress={() => setMoreOpen(false)}
                style={styles.closeButton}>
                <Text style={styles.closeGlyph}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetItems}>
              {mobileNavigation.overflow.map((item) => (
                <NavigationButton
                  key={item.id}
                  item={item}
                  active={isNavigationItemActive(pathname, item)}
                  onPress={() => navigateTo(item)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: signingOut }}
                disabled={signingOut}
                onPress={() => void signOut()}
                style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
                <Text style={styles.signOutGlyph}>↪</Text>
                <Text style={styles.signOutLabel}>{signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Sidebar(props: {
  items: WorkspaceNavigationItem[];
  pathname: string;
  fullName: string;
  role: UserRole;
  onNavigate: (item: WorkspaceNavigationItem) => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
        <Text style={styles.brandName}>MAY DAY</Text>
      </View>
      <View style={styles.workspaceIdentity}>
        <View style={styles.workspaceAvatar}><Text style={styles.workspaceAvatarText}>M</Text></View>
        <View style={styles.workspaceCopy}>
          <Text style={styles.workspaceName}>May Day</Text>
          <Text style={styles.workspaceCaption}>Không gian y tế</Text>
        </View>
      </View>
      <NavigationPanel {...props} />
    </View>
  );
}

function NavigationPanel(props: {
  items: WorkspaceNavigationItem[];
  pathname: string;
  fullName: string;
  role: UserRole;
  onNavigate: (item: WorkspaceNavigationItem) => void;
  onSignOut: () => void;
  signingOut: boolean;
  onClose?: () => void;
}) {
  const groups = [...new Set(props.items.map((item) => item.group))];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  return (
    <View style={styles.navigationPanel}>
      {props.onClose ? (
        <View style={styles.drawerHeading}>
          <Text style={styles.drawerTitle}>Điều hướng</Text>
          <Pressable accessibilityLabel="Đóng điều hướng" accessibilityRole="button" onPress={props.onClose} style={styles.closeButton}>
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.navScroll}>
        {groups.map((group) => (
          <View key={group} style={styles.navGroup}>
            <Pressable
              accessibilityLabel={`${collapsedGroups[group] ? 'Mở' : 'Thu gọn'} nhóm ${group}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsedGroups[group] }}
              onPress={() => setCollapsedGroups((current) => ({ ...current, [group]: !current[group] }))}
              style={styles.navGroupHeader}>
              <Text style={styles.navGroupLabel}>{group}</Text>
              <Text accessibilityElementsHidden style={styles.navGroupChevron}>{collapsedGroups[group] ? '›' : '⌄'}</Text>
            </Pressable>
            {!collapsedGroups[group] ? props.items.filter((item) => item.group === group).map((item) => (
              <NavigationButton
                key={item.id}
                item={item}
                active={isNavigationItemActive(props.pathname, item)}
                onPress={() => props.onNavigate(item)}
                compact={false}
              />
            )) : null}
          </View>
        ))}
      </ScrollView>
      <View style={styles.navFooter}>
        <View style={styles.scopeCard}>
          <Text style={styles.scopeTitle}>Phạm vi dữ liệu</Text>
          <Text style={styles.scopeText}>Hồ sơ và thao tác tuân theo quyền được cấp cho tài khoản.</Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.avatarSmall}>{props.fullName.trim().charAt(0).toUpperCase() || 'M'}</Text>
          <View style={styles.identityCopy}>
            <Text numberOfLines={1} style={styles.identityName}>{props.fullName}</Text>
            <Text style={styles.identityRole}>{roleLabels[props.role]}</Text>
          </View>
          <Pressable
            accessibilityLabel="Đăng xuất"
            accessibilityRole="button"
            accessibilityState={{ disabled: props.signingOut }}
            disabled={props.signingOut}
            onPress={props.onSignOut}
            style={styles.logoutIconButton}>
            <Text style={styles.logoutGlyph}>↪</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: props.signingOut }}
          disabled={props.signingOut}
          onPress={props.onSignOut}
          style={({ pressed }) => [styles.sidebarLogout, pressed && styles.pressed]}>
          <Text style={styles.signOutGlyph}>↪</Text>
          <Text style={styles.sidebarLogoutText}>{props.signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavigationButton({
  item,
  active,
  compact,
  onPress,
}: {
  item: WorkspaceNavigationItem;
  active: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={compact ? 'tab' : 'button'}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.bottomItem : styles.navItem,
        active && (compact ? styles.bottomItemActive : styles.navItemActive),
        pressed && styles.pressed,
      ]}>
      <Text style={[compact ? styles.bottomGlyph : styles.navGlyph, active && styles.activeGlyph]}>{item.glyph}</Text>
      <Text numberOfLines={1} style={[compact ? styles.bottomLabel : styles.navLabel, active && styles.activeLabel]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: appColors.canvas },
  workspace: { flex: 1, flexDirection: 'row', backgroundColor: appColors.canvas },
  sidebar: { width: 256, borderRightWidth: 1, borderRightColor: appColors.border, backgroundColor: appColors.surface, paddingTop: 16 },
  brand: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22 },
  brandMark: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: appColors.primary },
  brandMarkText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  brandName: { color: appColors.primaryDark, fontSize: 14, fontWeight: '900', letterSpacing: 1.15 },
  workspaceIdentity: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 14, marginTop: 16, marginBottom: 22, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, paddingHorizontal: 11 },
  workspaceAvatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: appColors.primarySoft },
  workspaceAvatarText: { color: appColors.primary, fontSize: 16, fontWeight: '900' },
  workspaceCopy: { flex: 1 },
  workspaceName: { color: appColors.ink, fontSize: 13, fontWeight: '800' },
  workspaceCaption: { marginTop: 3, color: appColors.muted, fontSize: 11 },
  main: { flex: 1, minWidth: 0, backgroundColor: appColors.canvas },
  topbar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 17, borderBottomWidth: 1, borderBottomColor: appColors.border, backgroundColor: appColors.surface, paddingHorizontal: 26 },
  topbarCompact: { paddingHorizontal: 16, gap: 12 },
  breadcrumb: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  breadcrumbBrand: { color: appColors.muted, fontSize: 13 },
  breadcrumbDivider: { color: appColors.muted, fontSize: 19 },
  breadcrumbTitle: { flexShrink: 1, color: appColors.ink, fontSize: 14, fontWeight: '800' },
  headerIconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: appColors.primarySoft },
  headerGlyph: { color: appColors.primary, fontSize: 18 },
  jumpSearch: { width: 250, height: 38, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: appColors.border, borderRadius: 10, backgroundColor: appColors.canvas, paddingHorizontal: 10 },
  searchGlyph: { color: appColors.muted, fontSize: 20 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: appColors.ink, fontSize: 12 },
  profileButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 3 },
  avatar: { width: 36, height: 36, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 12, backgroundColor: appColors.primarySoft, color: appColors.primary, fontSize: 13, fontWeight: '900', lineHeight: 36 },
  profileCopy: { maxWidth: 152 },
  profileName: { color: appColors.ink, fontSize: 12, fontWeight: '800' },
  profileRole: { marginTop: 3, color: appColors.muted, fontSize: 11 },
  profileChevron: { marginLeft: 2, color: appColors.muted, fontSize: 15 },
  page: { flex: 1, minHeight: 0 },
  workspaceFooter: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: appColors.border, backgroundColor: appColors.surface, paddingHorizontal: 26 },
  footerText: { color: appColors.muted, fontSize: 10 },
  navigationPanel: { flex: 1, minHeight: 0 },
  navScroll: { paddingBottom: 14 },
  navGroup: { marginBottom: 12, paddingHorizontal: 12 },
  navGroupHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4, paddingHorizontal: 10 },
  navGroupLabel: { color: appColors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  navGroupChevron: { color: appColors.muted, fontSize: 16 },
  navItem: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3, borderRadius: 9, paddingHorizontal: 11 },
  navItemActive: { backgroundColor: appColors.primarySoft },
  navGlyph: { width: 20, textAlign: 'center', color: appColors.muted, fontSize: 17 },
  activeGlyph: { color: appColors.primary },
  navLabel: { flex: 1, color: appColors.ink, fontSize: 12, fontWeight: '600' },
  activeLabel: { color: appColors.primary, fontWeight: '900' },
  navFooter: { borderTopWidth: 1, borderTopColor: appColors.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  scopeCard: { marginBottom: 11, borderRadius: 10, backgroundColor: appColors.canvas, padding: 11 },
  scopeTitle: { color: appColors.ink, fontSize: 11, fontWeight: '800' },
  scopeText: { marginTop: 4, color: appColors.muted, fontSize: 10, lineHeight: 15 },
  identityRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatarSmall: { width: 32, height: 32, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 11, backgroundColor: appColors.primarySoft, color: appColors.primary, fontSize: 12, fontWeight: '900', lineHeight: 32 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: { color: appColors.ink, fontSize: 11, fontWeight: '800' },
  identityRole: { marginTop: 2, color: appColors.muted, fontSize: 10 },
  logoutIconButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  logoutGlyph: { color: '#A43B3B', fontSize: 18 },
  sidebarLogout: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  sidebarLogoutText: { color: '#A43B3B', fontSize: 11, fontWeight: '700' },
  bottomBar: { minHeight: 58, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: appColors.border, backgroundColor: appColors.surface, paddingTop: 4 },
  bottomItem: { minWidth: 54, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 3, paddingVertical: 3 },
  bottomItemActive: { backgroundColor: appColors.primarySoft, borderRadius: 9, marginHorizontal: 2 },
  bottomGlyph: { minHeight: 21, color: appColors.muted, fontSize: 17, fontWeight: '700' },
  bottomLabel: { maxWidth: 78, color: appColors.muted, fontSize: 9, fontWeight: '700' },
  modalRoot: { flex: 1, flexDirection: 'row' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 37, 64, 0.35)' },
  drawer: { width: 320, maxWidth: '86%', alignSelf: 'stretch', backgroundColor: appColors.surface, paddingHorizontal: 12 },
  drawerHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  drawerTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: appColors.canvas },
  closeGlyph: { color: appColors.ink, fontSize: 25, lineHeight: 28 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  moreSheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: appColors.surface, paddingHorizontal: 20, paddingTop: 19 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sheetTitle: { color: appColors.ink, fontSize: 19, fontWeight: '900' },
  sheetSubtitle: { marginTop: 4, color: appColors.muted, fontSize: 12 },
  sheetItems: { paddingBottom: 14 },
  signOutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: appColors.border, marginTop: 8, paddingHorizontal: 11 },
  signOutGlyph: { color: '#A43B3B', fontSize: 18 },
  signOutLabel: { color: '#A43B3B', fontSize: 13, fontWeight: '800' },
  restrictedRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: appColors.canvas, padding: 24 },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: appColors.canvas },
  restrictedCard: { width: '100%', maxWidth: 480, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 24 },
  eyebrow: { color: appColors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  restrictedTitle: { marginTop: 12, color: appColors.ink, fontSize: 22, fontWeight: '900' },
  bodyText: { marginTop: 9, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 22, borderRadius: 12, backgroundColor: appColors.primary, paddingHorizontal: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});

export function WorkspaceLoading() {
  return (
    <SafeAreaView style={styles.loadingRoot} edges={['top', 'left', 'right', 'bottom']}>
      <ActivityIndicator accessibilityLabel="Đang tải không gian làm việc" color={appColors.primary} />
    </SafeAreaView>
  );
}
