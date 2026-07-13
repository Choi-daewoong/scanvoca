import { apiFetch } from './api';

export const visitService = {
  async track(visitorId: string, referrer: string): Promise<void> {
    await apiFetch('/api/v1/visits/track', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ visitor_id: visitorId, referrer }),
    });
  },
};
