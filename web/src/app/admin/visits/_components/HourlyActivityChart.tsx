'use client';

import { useState } from 'react';
import { VisitHourlyCount } from '@/types';

interface Props {
  hourly: VisitHourlyCount[];
}

// 백엔드가 0~23시 24개를 항상 채워서 보내므로 희소 배열 처리는 불필요
const TICK_HOURS = [0, 6, 12, 18];

export default function HourlyActivityChart({ hourly }: Props) {
  const [hovered, setHovered] = useState<VisitHourlyCount | null>(null);
  const max = Math.max(...hourly.map((h) => h.count), 1);

  if (hourly.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">아직 방문 기록이 없습니다.</p>;
  }

  return (
    <div>
      <div className="mb-2 h-5 text-xs text-gray-500 dark:text-gray-400">
        {hovered && (
          <span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{hovered.hour}시</span>
            {' · '}
            {hovered.count.toLocaleString()}명
          </span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[3px]">
        {hourly.map((h) => {
          const heightPct = (h.count / max) * 100;
          const isHovered = hovered?.hour === h.hour;
          return (
            <div
              key={h.hour}
              className="group relative flex-1"
              style={{ height: '100%' }}
              onMouseEnter={() => setHovered(h)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex h-full w-full items-end">
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    isHovered ? 'bg-indigo-500' : 'bg-indigo-300 dark:bg-indigo-500/50'
                  }`}
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex text-xs text-gray-400 dark:text-gray-500">
        {hourly.map((h) => (
          <span key={h.hour} className="flex-1 text-left">
            {TICK_HOURS.includes(h.hour) ? `${h.hour}시` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
