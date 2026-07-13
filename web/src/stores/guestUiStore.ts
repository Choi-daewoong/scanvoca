'use client';

import { create } from 'zustand';

interface GuestUiState {
  bannerVisible: boolean;
  upgradeModalOpen: boolean;
  showSaveBanner: () => void;
  hideSaveBanner: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
}

export const useGuestUiStore = create<GuestUiState>((set) => ({
  bannerVisible: false,
  upgradeModalOpen: false,
  showSaveBanner: () => set({ bannerVisible: true }),
  hideSaveBanner: () => set({ bannerVisible: false }),
  openUpgradeModal: () => set({ upgradeModalOpen: true }),
  closeUpgradeModal: () => set({ upgradeModalOpen: false }),
}));
