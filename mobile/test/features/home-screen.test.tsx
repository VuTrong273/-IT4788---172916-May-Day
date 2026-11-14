import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '@/app/index';
import { getSession } from '@/features/auth/session';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/features/auth/session', () => ({
  getSession: jest.fn(),
}));

describe('signed-out role selection', () => {
  beforeEach(() => {
    jest.mocked(getSession).mockResolvedValue(null);
  });

  test('renders role choices and routes the selected role to sign-in', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('MAY DAY')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Bác sĩ' }));
    fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/login',
      params: { role: 'doctor' },
    });
  });
});
