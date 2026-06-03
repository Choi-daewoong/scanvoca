'use client';

import { useState, useRef, useCallback } from 'react';
import { ocrService } from '@/services/ocrService';
import { wordbookService } from '@/services/wordbookService';
import { wordService } from '@/services/wordService';
import { OCRScanResponse, WordDefinition, Wordbook } from '@/types';
import Image from 'next/image';

type Step = 'upload' | 'processing' | 'result' | 'saving';

export default function ScanPage() {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OCRScanResponse | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [selectedWbId, setSelectedWbId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setError('');
    setStep('processing');
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const scanResult = await ocrService.scanImage(file);
      setResult(scanResult);
      // 기본적으로 모든 단어 선택
      setSelectedWords(new Set(scanResult.words.map((w) => w.word)));

      // 단어장 목록 로드
      const wbList = await wordbookService.list();
      setWordbooks(wbList);
      if (wbList.length > 0) setSelectedWbId(wbList[0].id);

      setStep('result');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '이미지 처리에 실패했습니다.';
      setError(msg.includes('Gemini') ? 'AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도하세요.' : msg);
      setStep('upload');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const toggleWord = (word: string) => {
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedWbId || selectedWords.size === 0) return;
    setStep('saving');
    try {
      // 선택한 단어들의 word_id를 서버에서 가져오기
      const wordsArray = Array.from(selectedWords);
      const genResult = await wordService.generate(wordsArray);

      for (const item of genResult.results) {
        if (item.data?.id) {
          try {
            await wordbookService.addWord(selectedWbId, item.data.id);
          } catch {
            // 이미 추가된 단어는 무시
          }
        }
      }

      setSaveSuccess(true);
      setStep('result');
    } catch {
      setError('단어 저장에 실패했습니다.');
      setStep('result');
    }
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setSelectedWords(new Set());
    setError('');
    setSaveSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // 업로드 화면
  if (step === 'upload') {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-8">
        {/* 히어로 섹션 */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">스마트 단어 스캔</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            교재·노트 사진을 찍으면<br />
            Gemini AI가 영단어를 자동으로 추출합니다
          </p>
        </div>

        {error && (
          <div className="mb-6 w-full max-w-sm rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          {/* 카메라 촬영 (모바일에서 카메라 직접 실행) */}
          <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            카메라로 촬영하기
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* 갤러리 선택 */}
          <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-95">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            갤러리에서 선택
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          JPEG, PNG, WebP 지원 · 최대 10MB
        </p>
      </div>
    );
  }

  // 처리 중 화면
  if (step === 'processing') {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-6 px-4">
        {preview && (
          <div className="relative h-48 w-full max-w-sm overflow-hidden rounded-2xl">
            <Image src={preview} alt="분석 중인 이미지" fill className="object-cover opacity-60" />
          </div>
        )}
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-base font-semibold text-gray-900">AI가 단어를 분석하고 있어요</p>
          <p className="mt-1 text-sm text-gray-500">Gemini Vision이 영단어를 추출 중...</p>
        </div>
      </div>
    );
  }

  // 결과 화면
  if ((step === 'result' || step === 'saving') && result) {
    return (
      <div className="px-4 py-6">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">스캔 결과</h2>
            <p className="text-sm text-gray-500">
              {result.total_extracted}개 추출 · {result.words.length}개 정의 완료
            </p>
          </div>
          <button onClick={reset} className="text-sm font-medium text-indigo-600 hover:underline">
            다시 스캔
          </button>
        </div>

        {/* 이미지 미리보기 */}
        {preview && (
          <div className="relative mb-4 h-36 w-full overflow-hidden rounded-2xl bg-gray-100">
            <Image src={preview} alt="스캔한 이미지" fill className="object-cover" />
          </div>
        )}

        {/* 성공 메시지 */}
        {saveSuccess && (
          <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            ✓ 단어장에 저장됐습니다!
          </div>
        )}

        {/* 단어 목록 */}
        {result.words.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 px-6 py-10 text-center">
            <p className="text-gray-500">인식된 영단어가 없습니다.</p>
            <p className="mt-1 text-sm text-gray-400">영어 텍스트가 포함된 이미지를 사용해보세요.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {selectedWords.size}개 선택됨
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedWords(new Set(result.words.map((w) => w.word)))}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setSelectedWords(new Set())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              {result.words.map((word) => (
                <WordResultCard
                  key={word.word}
                  word={word}
                  selected={selectedWords.has(word.word)}
                  onToggle={() => toggleWord(word.word)}
                />
              ))}
            </div>

            {/* 저장 영역 */}
            {!saveSuccess && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">단어장에 저장하기</p>
                {wordbooks.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    단어장이 없습니다.{' '}
                    <a href="/wordbooks" className="text-indigo-600 underline">단어장 만들기</a>
                  </p>
                ) : (
                  <>
                    <select
                      value={selectedWbId ?? ''}
                      onChange={(e) => setSelectedWbId(Number(e.target.value))}
                      className="mb-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                    >
                      {wordbooks.map((wb) => (
                        <option key={wb.id} value={wb.id}>
                          {wb.name} ({wb.word_count}개)
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSave}
                      disabled={step === 'saving' || selectedWords.size === 0}
                      className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {step === 'saving' ? '저장 중...' : `${selectedWords.size}개 단어 저장`}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

function WordResultCard({
  word,
  selected,
  onToggle,
}: {
  word: WordDefinition;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstMeaning = word.meanings?.[0];

  const speakWord = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word.word);
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 체크박스 */}
        <button
          onClick={onToggle}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
            selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
          }`}
        >
          {selected && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* 단어 정보 */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-gray-900">{word.word}</span>
            {word.pronunciation && (
              <span className="text-xs text-gray-400">{word.pronunciation}</span>
            )}
            {word.difficulty && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                word.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                word.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                Lv.{word.difficulty}
              </span>
            )}
          </div>
          {firstMeaning && (
            <p className="mt-0.5 text-sm text-gray-600 truncate">
              <span className="text-gray-400 text-xs">{firstMeaning.partOfSpeech} </span>
              {firstMeaning.korean}
            </p>
          )}
        </div>

        {/* TTS 버튼 */}
        <button
          onClick={speakWord}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-indigo-600"
          title="발음 듣기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
          </svg>
        </button>
      </div>

      {/* 확장: 예문 */}
      {expanded && firstMeaning?.examples && firstMeaning.examples.length > 0 && (
        <div className="border-t border-indigo-100 px-4 py-3">
          {firstMeaning.examples.slice(0, 1).map((ex, i) => (
            <div key={i} className="text-sm">
              <p className="text-gray-700 italic">{ex.en}</p>
              <p className="mt-0.5 text-gray-500">{ex.ko}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
