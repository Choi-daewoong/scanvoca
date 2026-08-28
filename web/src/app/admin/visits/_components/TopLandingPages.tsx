'use client';

import { VisitLandingPageCount } from '@/types';

interface Props {
  pages: VisitLandingPageCount[];
}

// 백엔드가 이미 count 내림차순 정렬 + 상위 10개로 잘라서 주므로 그대로 렌더한다
export default function TopLandingPages({ pages }: Props) {
  if (pages.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>;
  }

  return (
    <ol className="space-y-2">
      {pages.map((page, index) => (
        <li key={page.path} className="flex items-center gap-3 text-sm">
          <span className="w-5 shrink-0 text-right text-xs font-semibold text-indigo-500 dark:text-indigo-400">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-gray-700 dark:text-gray-300" title={page.path}>
            {page.path}
          </span>
          <span className="shrink-0 text-gray-400 dark:text-gray-500">{page.count.toLocaleString()}명</span>
        </li>
      ))}
    </ol>
  );
}
