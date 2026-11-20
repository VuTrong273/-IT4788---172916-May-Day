import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminUsersScreen } from '@/features/admin/admin-users-screen';
import { adminUsersApi } from '@/features/admin/admin-users-api';
import { PermissionsProvider } from '@/components/permission-controls';
import type { Session } from '@/features/auth/session';

jest.mock('@/features/admin/admin-users-api', () => ({ adminUsersApi: { listUsers: jest.fn(), getUser: jest.fn() } }));
const user = { user_id: 7, full_name: 'Nguyễn An', phone: '0900000007', role_id: 3, is_active: 1 as const };
const grants = [{ method: 'GET', path: '/api/v1/admin/users' }, { method: 'GET', path: '/api/v1/admin/users/:id' }];
const session: Session = { token: 'test', user: { ...user, role_id: 1 }, access: { user_id: 7, role_id: 1, base_role: 'admin', endpoints: grants, routes: grants } };

test('opens account details in a dismissible modal when a user is pressed', async () => {
  jest.mocked(adminUsersApi.listUsers).mockResolvedValue({ code: '1000', message: 'OK', data: [user], total: 1 });
  jest.mocked(adminUsersApi.getUser).mockResolvedValue(user);
  await render(<PermissionsProvider session={session}><AdminUsersScreen session={session} /></PermissionsProvider>);
  await waitFor(() => expect(screen.getByText('Nguyễn An')).toBeTruthy());
  await fireEvent.press(screen.getByText('Nguyễn An'));
  await waitFor(() => expect(screen.getByText('Mã người dùng: 7')).toBeTruthy());
  expect(adminUsersApi.getUser).toHaveBeenCalledWith(session, 7);
  expect(screen.queryByText('Sửa người dùng')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Đóng chi tiết tài khoản'));
  await waitFor(() => expect(screen.queryByText('Mã người dùng: 7')).toBeNull());
});
