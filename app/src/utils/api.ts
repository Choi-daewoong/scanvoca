// src/utils/api.ts

import { ENV } from './env';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = ENV.API_BASE_URL;

interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}

// Add a custom option to RequestInit to track retries
interface CustomRequestInit extends RequestInit {
  _isRetry?: boolean;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private isRefreshing = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: CustomRequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const config: CustomRequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    try {
      // If we are refreshing, don't trigger new requests
      if (this.isRefreshing && endpoint !== '/api/v1/auth/refresh') {
        // A better implementation would queue requests, but for now we fail them
        throw { message: 'Token refresh in progress', status: 429 };
      }

      console.log(`[API] ${config.method || 'GET'} ${url}`);

      const response = await fetch(url, config);
      
      // Handle cases where response is not JSON (e.g., 204 No Content)
      if (response.status === 204) {
        return { data: null as T, status: response.status };
      }
      
      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.detail || data.message || 'API 요청 실패',
          status: response.status,
          detail: data.detail,
        } as ApiError;
      }

      return {
        data,
        status: response.status,
        message: data.message,
      };
    } catch (error: any) {
      console.error(`[API Error] ${config.method || 'GET'} ${url}:`, error);

      // Token refresh logic
      if (error.status === 401 && !config._isRetry && endpoint !== '/api/v1/auth/refresh') {
        this.isRefreshing = true;
        try {
          console.log('[API Interceptor] 401 detected. Attempting to refresh token...');
          const refreshed = await useAuthStore.getState().refreshAccessToken();
          
          if (refreshed) {
            console.log('[API Interceptor] Token refreshed. Retrying original request.');
            // The token is now updated in defaultHeaders via the authStore
            // Retry the original request
            config._isRetry = true;
            return await this.request<T>(endpoint, config);
          } else {
            console.log('[API Interceptor] Token refresh failed. Logging out.');
            // The refreshAccessToken function already handles logout
            throw error; // Throw original 401 error
          }
        } finally {
          this.isRefreshing = false;
        }
      }

      if (error.status) {
        throw error;
      }
      
      throw {
        message: '네트워크 오류가 발생했습니다.',
        status: 0,
      } as ApiError;
    }
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }
}

export const apiClient = new ApiClient(API_BASE_URL);