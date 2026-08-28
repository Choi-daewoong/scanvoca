'use client';

interface Props {
  devices: Record<string, number>;
  browsers: Record<string, number>;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: '모바일',
  tablet: '태블릿',
  pc: 'PC',
  unknown: '알 수 없음',
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

export default function DeviceBrowserBreakdown({ devices, browsers }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-3 text-xs font-semibold text-gray-400 dark:text-gray-500">기기 유형</h3>
        <BarList data={devices} labels={DEVICE_LABELS} />
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold text-gray-400 dark:text-gray-500">브라우저</h3>
        <BarList data={browsers} />
      </div>
    </div>
  );
}
