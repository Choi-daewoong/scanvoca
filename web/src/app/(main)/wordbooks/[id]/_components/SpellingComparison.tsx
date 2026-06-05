export default function SpellingComparison({ correct, userInput }: { correct: string; userInput: string }) {
  const correctChars = correct.toLowerCase().split('');
  const userChars = userInput.toLowerCase().trim().split('');
  const maxLen = Math.max(correctChars.length, userChars.length);
  const isAllCorrect = correct.toLowerCase() === userInput.toLowerCase().trim();

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="w-10 shrink-0 text-[10px] text-gray-400">내 답</span>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: maxLen }).map((_, i) => {
            const u = userChars[i] ?? '';
            const c = correctChars[i] ?? '';
            const match = u !== '' && u === c;
            const wrong = u !== '' && u !== c;
            return (
              <div
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded border-2 text-xs font-bold uppercase ${
                  match
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : wrong
                    ? 'border-red-400 bg-red-400 text-white'
                    : 'border-gray-200 bg-gray-100 text-gray-300'
                }`}
              >
                {u}
              </div>
            );
          })}
          {userInput.trim() === '' && (
            <span className="text-xs text-gray-400">(미입력)</span>
          )}
        </div>
      </div>

      {!isAllCorrect && (
        <div className="flex items-center gap-1">
          <span className="w-10 shrink-0 text-[10px] text-gray-400">정답</span>
          <div className="flex flex-wrap gap-1">
            {correctChars.map((c, i) => {
              const u = userChars[i] ?? '';
              const match = u === c;
              return (
                <div
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded border-2 text-xs font-bold uppercase ${
                    match
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                      : 'border-indigo-300 bg-indigo-100 text-indigo-700'
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
