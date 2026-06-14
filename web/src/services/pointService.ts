import { apiFetch } from './api';
import { PointHistoryResponse } from '@/types';

export const pointService = {
  async history(limit = 50, offset = 0): Promise<PointHistoryResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return apiFetch<PointHistoryResponse>(`/api/v1/points/history?${params.toString()}`);
  },
};
