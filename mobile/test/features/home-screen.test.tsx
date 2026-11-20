import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import EntryScreen from '@/app/index';
import { getSession } from '@/features/auth/session';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@/features/auth/session', () => ({ getSession: jest.fn() }));

describe('application entry', () => {
  beforeEach(() => jest.clearAllMocks());
  test('opens login directly when signed out', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    await render(<EntryScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
  test('keeps an existing account in its authenticated workspace', async () => {
    jest.mocked(getSession).mockResolvedValue({ token: 'test', user: { user_id: 7, role_id: 2, full_name: 'Doctor', phone: '0900000000' } });
    await render(<EntryScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/home'));
  });
});
