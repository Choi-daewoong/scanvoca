'use client';

interface Props {
  label: string;
  value: number;
}

export default function StatCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value.toLocaleString()}<span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">명</span></p>
    </div>
  );
}
