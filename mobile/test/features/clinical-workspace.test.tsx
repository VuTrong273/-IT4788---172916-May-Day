import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ClinicalWorkspace } from '@/features/clinical/clinical-workspace';
import { medicalRecordsApi } from '@/features/doctor/medical-records-api';
import type { Session } from '@/features/auth/session';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('@/features/doctor/medical-records-api', () => ({ medicalRecordsApi: { history: jest.fn(), get: jest.fn() } }));
jest.mock('@/features/clinical/clinical-record-panel', () => ({
  ClinicalRecordPanel: ({ recordId, mode, canWrite }: { recordId: number; mode: string; canWrite: boolean }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, `clinical:${recordId}:${mode}:${canWrite}`);
  },
}));

const grants = [
  { method: 'GET', path: '/lab-results/:id' },
  { method: 'GET', path: '/prescriptions/:id' },
  { method: 'GET', path: '/medical_records/:id' },
];
const session: Session = {
  token: 'test', user: { user_id: 8, full_name: 'Test', phone: '000', role_id: 3, base_role: 'patient' },
  access: { user_id: 8, role_id: 3, base_role: 'patient', endpoints: grants, routes: grants },
};
const history = [
  { medical_record_id: 1, status: 'completed' as const, instructions: 'Tái khám theo hẹn', created_at: '2026-01-01' },
  { medical_record_id: 2, status: 'in_progress' as const, instructions: null, created_at: '2026-02-01' },
];

test('opens the latest visit, switches to prescriptions and preserves read-only patient access', async () => {
  jest.mocked(medicalRecordsApi.history).mockResolvedValue(history);
  await render(<ClinicalWorkspace session={session} />);
  await waitFor(() => expect(screen.getByText('clinical:2:lab:false')).toBeTruthy());
  await fireEvent.press(screen.getByText('Đơn thuốc'));
  await waitFor(() => expect(screen.getByText('clinical:2:prescription:false')).toBeTruthy());
  await fireEvent.press(screen.getByText('#1'));
  await waitFor(() => expect(screen.getByText('clinical:1:prescription:false')).toBeTruthy());
  expect(screen.getByText('Tái khám theo hẹn')).toBeTruthy();
}, 15000);

test('shows an empty state when the patient has no visits', async () => {
  jest.mocked(medicalRecordsApi.history).mockResolvedValue([]);
  await render(<ClinicalWorkspace session={session} />);
  await waitFor(() => expect(screen.getByText('Chưa có lịch sử khám')).toBeTruthy());
});

test('retries a failed history request', async () => {
  jest.mocked(medicalRecordsApi.history).mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce(history);
  await render(<ClinicalWorkspace session={session} />);
  await waitFor(() => expect(screen.getByText('Mất kết nối')).toBeTruthy());
  await fireEvent.press(screen.getByText('Thử lại'));
  await waitFor(() => expect(screen.getByText('clinical:2:lab:false')).toBeTruthy());
});

test.each(['in_progress', 'completed'] as const)('only enables editing for an assigned doctor on an in-progress record (%s)', async (status) => {
  const doctor: Session = { ...session, user: { ...session.user, role_id: 2, base_role: 'doctor' }, access: { ...session.access!, role_id: 2, base_role: 'doctor' } };
  jest.mocked(medicalRecordsApi.get).mockResolvedValue({
    medical_record_id: 12, patient_id: 9, assigned_doctor_id: 8, template_id: 'test', status,
    created_at: '2026-01-01', created_by: 8, instructions: null, completed_at: null, updated_at: '2026-01-01',
  });
  await render(<ClinicalWorkspace session={doctor} recordId={12} initialMode="prescription" />);
  await waitFor(() => expect(screen.getByText(`clinical:12:prescription:${status === 'in_progress'}`)).toBeTruthy());
});
