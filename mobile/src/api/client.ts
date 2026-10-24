import { create } from 'axios';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const apiClient = create({
  baseURL: apiUrl,
  timeout: 10000,
});
