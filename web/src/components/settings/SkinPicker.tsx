'use client';

import { SKIN_PRESETS } from '@/lib/skins';
import { useAppearanceStore } from '@/stores/appearanceStore';

export default function SkinPicker() {
  const { skinId, setSkin } = useAppearanceStore();

  return (
    <div className="flex items-center gap-1">
      {SKIN_PRESETS.map((skin) => {
        const selected = skinId === skin.id;
        return (
          <button
            key={skin.id}
            onClick={() => setSkin(skin.id)}
            aria-label={`${skin.label} 테마`}
            aria-pressed={selected}
            title={skin.label}
            className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span
              className={`h-6 w-6 rounded-full border border-black/10 transition ${
                selected
                  ? 'ring-2 ring-gray-400 ring-offset-2 ring-offset-white dark:ring-gray-500 dark:ring-offset-gray-900'
                  : ''
              }`}
              style={{ backgroundColor: skin.swatch }}
            />
          </button>
        );
      })}
    </div>
  );
}
