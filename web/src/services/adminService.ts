import { apiFetch } from './api';
import { AdminStats, AdminUserListResponse, AdminPointListResponse, VisitStats } from '@/types';

export interface AdminNotifications {
  qna_waiting: number;
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    return apiFetch<AdminStats>('/api/v1/admin/stats');
  },

  async listUsers(options?: { limit?: number; offset?: number; search?: string }): Promise<AdminUserListResponse> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.search) params.set('search', options.search);
    return apiFetch<AdminUserListResponse>(`/api/v1/admin/users?${params.toString()}`);
  },

  async deleteUser(userId: number): Promise<void> {
    await apiFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
  },

  async listPointTransactions(options?: {
    limit?: number;
    offset?: number;
    user_id?: number;
    reason?: string;
  }): Promise<AdminPointListResponse> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.user_id !== undefined) params.set('user_id', String(options.user_id));
    if (options?.reason) params.set('reason', options.reason);
    return apiFetch<AdminPointListResponse>(`/api/v1/admin/points?${params.toString()}`);
  },

  async getNotifications(): Promise<AdminNotifications> {
    return apiFetch<AdminNotifications>('/api/v1/admin/notifications');
  },

  async getVisitStats(): Promise<VisitStats> {
    return apiFetch<VisitStats>('/api/v1/admin/visits');
  },
};
