# Scan_Voca 개발 현황 및 OCR 설정 가이드 (2025-01-19)

## 🎯 현재 상황 요약

### ✅ 완료된 작업
- **Dev Client 환경 구축**: EAS Build로 커스텀 APK 생성 및 설치 완료
- **ImagePicker API 수정**: `ScanScreen.tsx`의 잘못된 enum 참조 수정 완료
- **Mock OCR 구현**: MLKit 대신 Mock 데이터로 OCR 기능 임시 구현
- **카메라/갤러리 기본 플로우**: 이미지 선택 → OCR 처리 → 결과 화면 이동

### 🔧 현재 동작 상태
- **갤러리 선택**: 정상 동작 (ImagePicker API 수정으로 오류 해결)
- **카메라 촬영**: 정상 동작 (VisionCamera 사용)
- **OCR 처리**: Mock 데이터로 동작 (실제 텍스트 인식은 아님)
- **단어 검색**: 데이터베이스에서 Mock 단어들 검색 및 결과 표시

### 📱 Mock OCR 데이터
현재 인식되는 Mock 단어들:
```
hello, world, education, vocabulary, learning, english, study, book, text, scan
```

---

## 🔍 실제 OCR 사용을 위한 완전한 설정 가이드

### 1단계: Git 커밋 및 정리
```bash
# 현재 변경사항 커밋
git add .
git commit -m "Add mock OCR implementation for development"

# 또는 특정 파일만 커밋
git add src/services/ocrService.ts
git commit -m "Temporarily use mock OCR data"
```

### 2단계: 네이티브 프로젝트 재생성
```bash
# app 디렉토리에서 실행
cd app

# 기존 네이티브 코드 삭제 후 재생성
npx expo prebuild --clean

# 또는 특정 플랫폼만
npx expo prebuild --platform android --clean
```

### 3단계: MLKit 라이브러리 확인
```bash
# MLKit 라이브러리 재설치
npm install @react-native-ml-kit/text-recognition

# 또는 최신 버전으로 업데이트
npm install @react-native-ml-kit/text-recognition@latest
```

### 4단계: OCR 서비스 코드 복원
`src/services/ocrService.ts`에서 다음 수정:

```typescript
// 1. Import 주석 해제
import TextRecognition from '@react-native-ml-kit/text-recognition';

// 2. extractTextFromImage 메서드를 실제 MLKit 구현으로 교체
async extractTextFromImage(imageUri: string): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    console.log('🔍 MLKit OCR 처리 시작:', imageUri);

    // Android에서 content:// 또는 file:// 경로를 MLKit이 읽을 수 있도록 파일 경로 정규화
    let normalizedPath = imageUri;
    try {
      if (Platform.OS === 'android' && imageUri.startsWith('content://')) {
        const destPath = `${FileSystem.cacheDirectory}ocr-${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: imageUri, to: destPath });
        normalizedPath = destPath;
      }
      if (normalizedPath.startsWith('file://')) {
        normalizedPath = normalizedPath.replace('file://', '');
      }
    } catch (normErr) {
      console.warn('⚠️ 이미지 경로 정규화 실패, 원본 경로로 시도:', normErr);
    }

    // MLKit Text Recognition으로 실제 텍스트 인식
    const result = await TextRecognition.recognize(normalizedPath);

    console.log('MLKit 인식 결과:', result);

    // 인식된 블록들을 단어로 분리하여 OCRWord 형식으로 변환
    const words: OCRWord[] = [];

    result.blocks.forEach((block) => {
      block.lines.forEach((line) => {
        line.elements.forEach((element) => {
          // 각 요소의 텍스트를 단어로 분리
          const wordTexts = element.text.split(/\s+/).filter(w => w.length > 0);

          wordTexts.forEach((wordText, index) => {
            words.push({
              text: wordText,
              confidence: element.confidence || 0.8,
              boundingBox: element.frame ? {
                x: element.frame.x,
                y: element.frame.y,
                width: element.frame.width,
                height: element.frame.height
              } : undefined
            });
          });
        });
      });
    });

    const processingTime = Date.now() - startTime;
    const fullText = result.text;

    console.log(`✅ MLKit OCR 완료: ${words.length}개 단어 감지, 처리시간: ${processingTime}ms`);
    console.log('인식된 텍스트:', fullText);

    return {
      text: fullText,
      words: words,
      processingTime,
      imageUri,
    };
  } catch (error) {
    console.error('❌ MLKit OCR 처리 실패:', error);
    throw new Error('Failed to extract text from image');
  }
}
```

### 5단계: Dev Client 재빌드
```bash
# EAS Build로 새로운 Dev Client APK 생성
eas build --profile development --platform android

# 또는 로컬에서 직접 빌드
npx expo run:android
```

### 6단계: 새 APK 설치 및 테스트
1. 새로 빌드된 APK를 기기에 설치
2. 기존 Scan Voca 앱 제거 후 새 버전 설치
3. 개발 서버 연결: `npx expo start --dev-client --lan`
4. 실제 이미지로 OCR 테스트

---

## 🚨 주의사항 및 트러블슈팅

### MLKit 라이브러리 문제 해결
- **"TurboModule not found" 오류**: Dev Client 재빌드 필요
- **"Native module is null" 오류**: `npx expo prebuild --clean` 후 재빌드
- **권한 오류**: Android 권한 설정 확인 (`app.json`의 permissions 배열)

### 성능 최적화
- **이미지 크기 제한**: 너무 큰 이미지는 처리 시간 증가
- **캐시 활용**: `FileSystem.cacheDirectory` 사용으로 임시 파일 관리
- **에러 핸들링**: OCR 실패 시 Mock 데이터로 폴백 가능

### 개발 워크플로우
1. **일반 개발**: Mock OCR로 UI/UX 개발
2. **OCR 테스트**: 실제 MLKit으로 전환하여 정확도 테스트
3. **성능 최적화**: 이미지 전처리 및 후처리 로직 개선

---

## 📋 체크리스트

### Mock OCR에서 실제 OCR 전환 시
- [ ] Git 커밋 완료
- [ ] `npx expo prebuild --clean` 실행
- [ ] MLKit import 주석 해제
- [ ] `extractTextFromImage` 메서드 실제 구현으로 교체
- [ ] Dev Client 재빌드 (`eas build --profile development`)
- [ ] 새 APK 설치 및 테스트
- [ ] 실제 이미지로 OCR 정확도 확인
- [ ] 에러 핸들링 및 폴백 로직 테스트

### 현재 Mock OCR 상태에서 개발 가능한 작업
- [ ] 스캔 결과 화면 UI/UX 개선
- [ ] 단어장 저장 기능 완성
- [ ] 퀴즈 시스템 개발
- [ ] 학습 진도 추적 기능
- [ ] 사용자 인터페이스 개선

---

## 🔄 롤백 방법

실제 OCR에서 문제가 발생하면 Mock OCR로 쉽게 롤백 가능:

```typescript
// src/services/ocrService.ts
// import TextRecognition from '@react-native-ml-kit/text-recognition'; // 주석 처리
// extractTextFromImage 메서드를 Mock 구현으로 교체
```

이렇게 하면 네이티브 모듈 문제 없이 개발을 계속할 수 있습니다.

---

*마지막 업데이트: 2025-01-19*
*현재 상태: Mock OCR 사용 중, 실제 OCR 전환 준비 완료*
