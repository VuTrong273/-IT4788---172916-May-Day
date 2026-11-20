import { useCallback, useEffect, useState } from 'react';
import { apiRequest, type ApiEnvelope } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth-context';

export type Row = Record<string, unknown>;
export type Result<T> = ApiEnvelope<T> & {
  total?: number;
  page?: number;
  limit?: number;
};
export function useApi() {
  const { session, can } = useAuth();
  const token = session?.token;
  return useCallback(
    <T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) => {
      if (!can(method, path)) return Promise.reject(new Error('Bạn chưa được cấp quyền thực hiện thao tác này.'));
      return apiRequest<Result<T>>(path, {
        token,
        method,
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    [token, can],
  );
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
export const label = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value);
export const rowId = (row: Row) =>
  String(
    row.id ??
      row.user_id ??
      row.code_template ??
      row.section_id ??
      row.question_id ??
      row.medical_record_id,
  );
export function useData<T>(path: string | null, initial: T) {
  const api = useApi();
  const { can } = useAuth();
  const permittedPath = path && can('GET', path) ? path : null;
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!permittedPath) {
      setData(initial);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    api<T>(permittedPath, 'GET', undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, permittedPath, revision]);
  return { data, error, loading, reload };
}

export async function allPages<T>(
  api: ReturnType<typeof useApi>,
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?';
  const first = await api<T[]>(
    `${path}${separator}page=1&limit=100`,
    'GET',
    undefined,
    signal,
  );
  const result = [...first.data];
  const pages = Math.ceil((first.total ?? first.data.length) / 100);
  for (let page = 2; page <= pages; page++) {
    result.push(
      ...(
        await api<T[]>(
          `${path}${separator}page=${page}&limit=100`,
          'GET',
          undefined,
          signal,
        )
      ).data,
    );
  }
  return result;
}
