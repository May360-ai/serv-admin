import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ErrorHttp } from './error-http';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('serv_token');
}

function setToken(token: string, rol?: string): void {
  localStorage.setItem('serv_token', token);
  if (typeof document !== 'undefined') {
    document.cookie = `serv_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
    if (rol) {
      document.cookie = `serv_role=${encodeURIComponent(rol)}; path=/; max-age=604800; SameSite=Lax`;
    }
  }
}

function removeToken(): void {
  localStorage.removeItem('serv_token');
  localStorage.removeItem('serv_usuario');
  if (typeof document !== 'undefined') {
    document.cookie = 'serv_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'serv_role=; path=/; max-age=0; SameSite=Lax';
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor de REQUEST: agrega el Bearer Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Interceptor de RESPONSE: manejo centralizado de errores
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const isLoginEndpoint = error.config?.url?.includes('/api/auth/login');
    if (error.response?.status === 401 && !isLoginEndpoint) {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(new ErrorHttp(error.response?.status));
  }
);

export { apiClient, getToken, setToken, removeToken, BASE_URL };
