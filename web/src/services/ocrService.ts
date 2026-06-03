import { apiFetch } from './api';
import { OCRScanResponse } from '@/types';

export const ocrService = {
  async scanImage(file: File): Promise<OCRScanResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return apiFetch<OCRScanResponse>('/api/v1/ocr/scan', {
      method: 'POST',
      body: formData,
    });
  },
};
