import axios from 'axios';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
});
