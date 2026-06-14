export default function AdminQnaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Q&A 관리</h1>
        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          준비 중
        </span>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          단어 의미, 학습법, 앱 사용법 등에 대한 사용자 질문과 답변을 관리하는 화면입니다.
          출시 시 아래와 같은 기능이 제공될 예정입니다.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-400 dark:text-gray-500">
          <li>답변 대기 중인 질문 목록 및 답변 작성</li>
          <li>좋아요 기반 인기 질문 정렬</li>
          <li>자주 묻는 질문(FAQ)으로 승격</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 opacity-50 md:grid-cols-2">
        {['비밀번호를 재설정했는데 이메일이 안 와요', '스캔한 단어가 이상하게 인식돼요'].map((title) => (
          <div key={title} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="font-medium text-gray-700 dark:text-gray-300">{title}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">답변 대기 · 예시 데이터</p>
          </div>
        ))}
      </div>
    </div>
  );
}
