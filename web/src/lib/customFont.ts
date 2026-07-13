// 커스텀 폰트 - 사용자가 올린 폰트 파일을 브라우저 IndexedDB에만 저장하고
// FontFace API로 등록한다 (서버 업로드 없음 - 폰트 라이선스 재배포 문제 회피)

import { CUSTOM_FONT_FAMILY } from './fonts';

const DB_NAME = 'scan_voca_appearance';
const STORE_NAME = 'fonts';
const RECORD_KEY = 'custom';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];

export interface CustomFontRecord {
  name: string;
  data: ArrayBuffer;
  addedAt: number;
}

// 재업로드 시 이전 FontFace를 document.fonts에서 제거하기 위한 참조
let registeredFace: FontFace | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomFont(record: CustomFontRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadCustomFont(): Promise<CustomFontRecord | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteCustomFont(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  if (registeredFace) {
    document.fonts.delete(registeredFace);
    registeredFace = null;
  }
}

/** 확장자 + 크기 + 매직바이트 검증. 문제 있으면 한국어 에러 메시지 반환, 정상이면 null */
export async function validateFontFile(file: File): Promise<string | null> {
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return '지원하지 않는 형식입니다. (.ttf, .otf, .woff, .woff2만 가능)';
  }
  if (file.size > MAX_SIZE) {
    return '파일이 너무 큽니다. (최대 20MB)';
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const tag = String.fromCharCode(...head);
  const isTtf = head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0;
  if (!isTtf && tag !== 'OTTO' && tag !== 'wOFF' && tag !== 'wOF2' && tag !== 'true') {
    return '올바른 폰트 파일이 아닙니다.';
  }
  return null;
}

/** FontFace 등록 - 손상 파일이면 예외 발생 */
export async function registerCustomFont(data: ArrayBuffer): Promise<void> {
  const face = new FontFace(CUSTOM_FONT_FAMILY, data);
  await face.load();
  if (registeredFace) {
    document.fonts.delete(registeredFace);
  }
  document.fonts.add(face);
  registeredFace = face;
}
