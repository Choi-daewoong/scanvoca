export default function SpellingComparison({ correct, userInput }: { correct: string; userInput: string }) {
  const correctChars = correct.toLowerCase().split('');
  const userChars = userInput.toLowerCase().trim().split('');
  const maxLen = Math.max(correctChars.length, userChars.length);
  const isAllCorrect = correct.toLowerCase() === userInput.toLowerCase().trim();

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="w-10 shrink-0 text-[10px] text-gray-400 dark:text-gray-500">내 답</span>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: maxLen }).map((_, i) => {
            const u = userChars[i] ?? '';
            const c = correctChars[i] ?? '';
            const match = u !== '' && u === c;
            const wrong = u !== '' && u !== c;
            return (
              <div
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-bold ${
                  match
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : wrong
                    ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                    : 'border-gray-200 bg-gray-100 text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600'
                }`}
              >
                {u}
              </div>
            );
          })}
          {userInput.trim() === '' && (
            <span className="text-xs text-gray-400 dark:text-gray-500">(미입력)</span>
          )}
        </div>
      </div>

      {!isAllCorrect && (
        <div className="flex items-center gap-1">
          <span className="w-10 shrink-0 text-[10px] text-gray-400 dark:text-gray-500">정답</span>
          <div className="flex flex-wrap gap-1">
            {correctChars.map((c, i) => {
              const u = userChars[i] ?? '';
              const match = u === c;
              return (
                <div
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-bold ${
                    match
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400'
                  }`}
                >
                  {c}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
