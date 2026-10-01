'use client';

import { useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지를 자르지 못했습니다.'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  });
}

interface ImageCropModalProps {
  file: File;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** 선택 영역(또는 전체 이미지)을 잘라낸 파일을 돌려준다. */
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

/** 사진을 찍은 뒤 분석할 영역을 드래그로 고르는 전체 화면 모달 (단어 스캔 화면과 같은 방식). */
export default function ImageCropModal({
  file,
  title = '분석할 영역 선택',
  description = '드래그해서 분석할 부분만 선택하세요.',
  confirmLabel = '선택 영역 분석하기',
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  // file마다 새로 마운트되는 모달이라 초기값으로 한 번만 만든다. 해제는 이미지 로드 직후에 한다.
  const [src] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // 이미지는 이미 디코딩되어 있어 URL을 해제해도 자르기(drawImage)에는 영향이 없다.
    URL.revokeObjectURL(src);
    setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
    setCompletedCrop({ unit: 'px', x: width * 0.1, y: height * 0.1, width: width * 0.8, height: height * 0.8 });
  };

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current || completedCrop.width === 0 || completedCrop.height === 0) {
      onConfirm(file);
      return;
    }
    try {
      onConfirm(await getCroppedFile(imgRef.current, completedCrop, file.name));
    } catch {
      onConfirm(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col gap-4 bg-white px-4 py-4 dark:bg-gray-950">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="원본 이미지"
            onLoad={onImageLoad}
            className="max-h-[calc(100vh-240px)] w-auto max-w-full object-contain"
          />
        </ReactCrop>
      </div>

      <div className="shrink-0 space-y-1.5">
        <button
          onClick={handleConfirm}
          className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 active:scale-95 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {confirmLabel}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(file)}
            className="flex-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            전체 이미지 사용
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 active:scale-95 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
