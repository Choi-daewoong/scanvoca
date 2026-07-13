'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ocrService } from '@/services/ocrService';
import { wordbookService } from '@/services/wordbookService';
import { wordService } from '@/services/wordService';
import { OCRScanResponse, WordDefinition, Wordbook } from '@/types';
import Image from 'next/image';
import { speakWord } from '@/utils/tts';
import { formatPartOfSpeech } from '@/utils/partOfSpeech';
import { useAuthStore } from '@/stores/authStore';
import { useGuestUiStore } from '@/stores/guestUiStore';

type Step = 'upload' | 'crop' | 'processing' | 'result' | 'saving';

async function getCroppedFile(image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<File> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.');

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('이미지를 자르지 못했습니다.')); return; }
      resolve(new File([blob], fileName, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}

export default function ScanPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const showSaveBanner = useGuestUiStore((s) => s.showSaveBanner);
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

  // 크롭 단계 상태
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

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
      setError(msg.includes('AI 분석 서비스') ? 'AI 분석 서비스를 사용할 수 없습니다. 잠시 후 다시 시도하세요.' : msg);
      setStep('upload');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setRawImageSrc(URL.createObjectURL(file));
    setCrop(undefined);
    setCompletedCrop(undefined);
    setStep('crop');
  };

  const onCropImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop({ unit: '%', x: 25, y: 25, width: 50, height: 50 });
    setCompletedCrop({ unit: 'px', x: width * 0.25, y: height * 0.25, width: width * 0.5, height: height * 0.5 });
  };

  const handleCropConfirm = async () => {
    if (!rawFile) return;
    if (!completedCrop || !imgRef.current || completedCrop.width === 0 || completedCrop.height === 0) {
      processImage(rawFile);
      return;
    }
    try {
      const cropped = await getCroppedFile(imgRef.current, completedCrop, rawFile.name);
      processImage(cropped);
    } catch {
      processImage(rawFile);
    }
  };

  const handleUseFullImage = () => {
    if (rawFile) processImage(rawFile);
  };

  const toggleWord = (word: string) => {
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const handleSave = async (wbId: number) => {
    if (!wbId || selectedWords.size === 0) return;
    setStep('saving');
    try {
      // 선택한 단어들의 word_id를 서버에서 가져오기
      const wordsArray = Array.from(selectedWords);
      const genResult = await wordService.generate(wordsArray);

      for (const item of genResult.results) {
        if (item.data?.id) {
          try {
            await wordbookService.addWord(wbId, item.data.id);
          } catch {
            // 이미 추가된 단어는 무시
          }
        }
      }

      setSaveSuccess(true);
      if (user?.is_guest) showSaveBanner();
      // 저장 후 바로 단어장 상세 페이지로 이동
      router.push(`/wordbooks/${wbId}`);
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
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawFile(null);
    setRawImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // 업로드 화면
  if (step === 'upload') {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-8">
        {/* 히어로 섹션 */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
            <svg className="h-12 w-12 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">스마트 단어 스캔</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed dark:text-gray-400">
            교재·노트 사진을 찍으면<br />
            AI가 영단어를 자동으로 추출합니다
          </p>
        </div>

        {error && (
          <div className="mb-6 w-full max-w-sm rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          {/* 카메라 촬영 (모바일에서 카메라 직접 실행) */}
          <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 active:scale-95 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70">
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
          <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
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

        <p className="mt-6 text-xs text-gray-400 text-center dark:text-gray-500">
          JPEG, PNG, WebP 지원 · 최대 10MB
        </p>
      </div>
    );
  }

  // 영역 선택(크롭) 화면
  if (step === 'crop' && rawImageSrc) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">분석할 영역 선택</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            드래그해서 분석할 부분만 선택하세요.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={rawImageSrc}
                alt="원본 이미지"
                onLoad={onCropImageLoad}
                className="max-h-full max-w-full w-auto object-contain"
              />
            </ReactCrop>
          </div>
        </div>

        <div className="shrink-0 space-y-1.5">
          <button
            onClick={handleCropConfirm}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 active:scale-95 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            선택 영역 분석하기
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleUseFullImage}
              className="flex-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              전체 이미지 사용
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              취소
            </button>
          </div>
        </div>
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
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">AI가 단어를 분석하고 있어요</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">AI가 영단어를 추출 중...</p>
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">스캔 결과</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {result.total_extracted}개 추출 · {result.words.length}개 정의 완료
            </p>
          </div>
          <button onClick={reset} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            다시 스캔
          </button>
        </div>

        {/* 이미지 미리보기 */}
        {preview && (
          <div className="relative mb-4 h-36 w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
            <Image src={preview} alt="스캔한 이미지" fill className="object-cover" />
          </div>
        )}

        {/* 성공 메시지 */}
        {saveSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            ✓ 단어장에 저장됐습니다!
          </div>
        )}

        {/* 단어 목록 */}
        {result.words.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">인식된 영단어가 없습니다.</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">영어 텍스트가 포함된 이미지를 사용해보세요.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedWords.size}개 선택됨
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedWords(new Set(result.words.map((w) => w.word)))}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setSelectedWords(new Set())}
                  className="text-xs text-gray-500 hover:underline dark:text-gray-400"
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
              <SaveToWordbookPanel
                wordbooks={wordbooks}
                setWordbooks={setWordbooks}
                selectedWbId={selectedWbId}
                setSelectedWbId={setSelectedWbId}
                selectedCount={selectedWords.size}
                isSaving={step === 'saving'}
                onSave={handleSave}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

function SaveToWordbookPanel({
  wordbooks,
  setWordbooks,
  selectedWbId,
  setSelectedWbId,
  selectedCount,
  isSaving,
  onSave,
}: {
  wordbooks: Wordbook[];
  setWordbooks: React.Dispatch<React.SetStateAction<Wordbook[]>>;
  selectedWbId: number | null;
  setSelectedWbId: (id: number) => void;
  selectedCount: number;
  isSaving: boolean;
  onSave: (wbId: number) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const wb = await wordbookService.create(newName.trim());
      setWordbooks((prev) => [...prev, wb]);
      setSelectedWbId(wb.id);
      setShowNew(false);
      setNewName('');
      onSave(wb.id);
    } catch {
      alert('단어장 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">단어장에 저장하기</p>

      {/* 기존 단어장 선택 */}
      {wordbooks.length > 0 && !showNew && (
        <select
          value={selectedWbId ?? ''}
          onChange={(e) => setSelectedWbId(Number(e.target.value))}
          className="mb-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {wordbooks.map((wb) => (
            <option key={wb.id} value={wb.id}>
              {wb.name} ({wb.word_count}개)
            </option>
          ))}
        </select>
      )}

      {/* 새 단어장 만들기 폼 */}
      {showNew ? (
        <div className="mb-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="새 단어장 이름"
            autoFocus
            className="mb-2 w-full rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-indigo-800 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || isSaving || !newName.trim() || selectedCount === 0}
              className="flex-1 rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
            >
              {creating || isSaving ? '저장 중...' : '만들고 저장하기'}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewName(''); }}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-300 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 단어장 만들기
        </button>
      )}

      {/* 저장 버튼 (기존 단어장 선택 시) */}
      {!showNew && wordbooks.length > 0 && (
        <button
          onClick={() => selectedWbId && onSave(selectedWbId)}
          disabled={isSaving || selectedCount === 0 || !selectedWbId}
          className="w-full rounded-xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {isSaving ? '저장 중...' : `${selectedCount}개 단어 저장`}
        </button>
      )}

      {/* 단어장이 없고 새 단어장 폼도 안 열린 경우 */}
      {wordbooks.length === 0 && !showNew && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">위에서 새 단어장을 만들어주세요</p>
      )}
    </div>
  );
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

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakWord(word.word);
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        selected
          ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30'
          : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 체크박스 */}
        <button
          onClick={onToggle}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
            selected ? 'border-indigo-400 bg-indigo-400' : 'border-gray-300 dark:border-gray-600'
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
            <span className="font-semibold text-gray-900 dark:text-gray-100">{word.word}</span>
            {word.pronunciation && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{word.pronunciation}</span>
            )}
          </div>
          {firstMeaning && (
            <p className="mt-0.5 text-sm text-gray-600 truncate dark:text-gray-400">
              <span className="text-gray-400 text-xs dark:text-gray-500">{formatPartOfSpeech(firstMeaning.partOfSpeech)} </span>
              {firstMeaning.korean}
            </p>
          )}
        </div>

        {/* TTS 버튼 */}
        <button
          onClick={handleSpeak}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
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
        <div className="border-t border-indigo-100 px-4 py-3 dark:border-indigo-900">
          {firstMeaning.examples.slice(0, 1).map((ex, i) => (
            <div key={i} className="text-sm">
              <p className="text-gray-700 italic dark:text-gray-300">{ex.en}</p>
              <p className="mt-0.5 text-gray-500 dark:text-gray-400">{ex.ko}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
