export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">신고/모더레이션</h1>
        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          준비 중
        </span>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          부적절하거나 저품질인 공유 게시글에 대한 신고를 접수하고 처리하는 화면입니다.
          출시 시 아래와 같은 기능이 제공될 예정입니다.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-400 dark:text-gray-500">
          <li>신고 누적 게시글 목록 (신고 사유/횟수)</li>
          <li>게시글 숨김/삭제 처리</li>
          <li>신고 누적 임계치 도달 시 자동 숨김</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 opacity-50 md:grid-cols-2">
        {[
          { title: '예시 단어장 - 고1 영단어 모음', reason: '광고/스팸', count: 3 },
          { title: '예시 단어장 - 토익 필수어휘', reason: '저품질/오타', count: 1 },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="font-medium text-gray-700 dark:text-gray-300">{item.title}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">신고 {item.count}건 · {item.reason} · 예시 데이터</p>
          </div>
        ))}
      </div>
    </div>
  );
}
