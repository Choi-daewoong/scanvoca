'use client';

import { useState } from 'react';
import { VisitDailyCount } from '@/types';

interface Props {
  daily: VisitDailyCount[];
}

export default function DailyVisitChart({ daily }: Props) {
  const [hovered, setHovered] = useState<VisitDailyCount | null>(null);
  const max = Math.max(...daily.map((d) => d.count), 1);

  if (daily.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">아직 방문 기록이 없습니다.</p>;
  }

  return (
    <div>
      <div className="mb-2 h-5 text-xs text-gray-500 dark:text-gray-400">
        {hovered && (
          <span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {new Date(hovered.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </span>
            {' · '}
            {hovered.count.toLocaleString()}명
          </span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[3px]">
        {daily.map((d) => {
          const heightPct = (d.count / max) * 100;
          const isHovered = hovered?.date === d.date;
          return (
            <div
              key={d.date}
              className="group relative flex-1"
              style={{ height: '100%' }}
              onMouseEnter={() => setHovered(d)}
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
      <div className="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{new Date(daily[0].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
        <span>{new Date(daily[daily.length - 1].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
      </div>
    </div>
  );
}
