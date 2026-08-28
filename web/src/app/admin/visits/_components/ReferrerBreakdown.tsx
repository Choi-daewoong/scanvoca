'use client';

interface Props {
  categories: Record<string, number>;
  referrers: Record<string, number>;
}

// 원본 호스트 표기 보정 (백엔드 카테고리는 이미 한글이라 매핑 불필요)
const REFERRER_LABELS: Record<string, string> = {
  direct: '직접 방문 / 북마크',
};

function BarList({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, count]) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{labels?.[key] || key}</span>
            <span className="text-gray-400 dark:text-gray-500">{count.toLocaleString()}명</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReferrerBreakdown({ categories, referrers }: Props) {
  return (
    <div className="space-y-5">
      <BarList data={categories} />

      <div>
        <h3 className="mb-3 text-xs font-semibold text-gray-400 dark:text-gray-500">상세 (도메인별)</h3>
        <BarList data={referrers} labels={REFERRER_LABELS} />
      </div>
    </div>
  );
}
