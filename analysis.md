## 카메라/갤러리 OCR 실패 원인 분석과 해결 방안

### 증상 요약
- 터미널 로그: "❌ 갤러리 선택 또는 OCR 처리 오류" / "❌ 카메라 촬영 또는 OCR 처리 오류"
- 에러 메시지: TypeError: Cannot read property 'Images' of undefined
- 실행 환경: Expo Go 사용 (터미널에 "Using Expo Go" 표시)

### 직접 확인한 코드 포인트
1) `ScanScreen.tsx`에서 `expo-image-picker` API 오사용

```73:82:app/src/screens/ScanScreen.tsx
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: [ImagePicker.MediaType.Images],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        videoMaxDuration: 30,
      });
```

```122:131:app/src/screens/ScanScreen.tsx
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [ImagePicker.MediaType.Images],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
```

- 올바른 enum은 `ImagePicker.MediaTypeOptions`이며, 배열이 아니라 단일 enum 값을 사용해야 합니다.
- 현재 코드처럼 `ImagePicker.MediaType.Images`를 참조하면 `undefined.Images` 접근이 되어 본문의 TypeError가 발생합니다.

2) `CameraScreen.tsx`의 갤러리 호출은 올바른 API 사용

```90:99:app/src/screens/CameraScreen.tsx
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
        selectionLimit: 1,
        presentationStyle: Platform.OS === 'ios' ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN : undefined,
      });
```

- 동일 리포지토리 내에서도 파일마다 API 사용이 상이합니다. `ScanScreen.tsx`만 잘못되어 있습니다.

3) 네이티브 모듈 사용과 실행 환경의 불일치 (중요)
- OCR: `@react-native-ml-kit/text-recognition` 사용
- 카메라: `react-native-vision-camera` 사용
- 두 라이브러리는 Expo Go에서 동작하지 않습니다. Dev Client(커스텀 개발 클라이언트) 또는 prebuild된 네이티브 앱이 필요합니다.

```16:48:app/package.json
    "expo": "~54.0.7",
    "expo-dev-client": "~6.0.12",
    "expo-image-picker": "~17.0.8",
    "react-native-vision-camera": "^4.7.2",
    "@react-native-ml-kit/text-recognition": "^2.0.0",
```

- 터미널에 "Using Expo Go"가 표시되어 있어, 설령 ImagePicker 호출이 고쳐지더라도 OCR/카메라 네이티브 모듈에서 추가 런타임 에러가 발생합니다(예: TurboModule not found, Native module is null 등).

### 근본 원인 정리
- 1차 원인: `ScanScreen.tsx`의 `expo-image-picker` API 오사용
  - 잘못된 참조: `ImagePicker.MediaType.Images` (존재하지 않음)
  - 잘못된 타입: `mediaTypes`에 배열 전달 (단일 enum 값이어야 함)
- 2차 원인: 실행 환경 미스매치
  - Expo Go에서는 `react-native-vision-camera`, `@react-native-ml-kit/text-recognition` 동작 불가
  - Dev Client 또는 네이티브 빌드가 필요

### 해결 방안 (수정 제안)
1) ImagePicker API 수정 (즉시 수정 가능한 부분)
- 대상 파일: `app/src/screens/ScanScreen.tsx`
- 수정 내용:
  - `mediaTypes: ImagePicker.MediaTypeOptions.Images`로 교체
  - 배열([]) 제거

예상 수정 후 형태:
- `launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, ... })`
- `launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, ... })`

2) 실행 환경 전환 (네이티브 모듈 사용 가능하도록)
- Expo Go 대신 Dev Client로 실행
  - Android: 개발용 클라이언트 빌드 후 `npx expo start --dev-client`로 접속
  - 또는 `expo prebuild`/`expo run:android`를 통해 네이티브 프로젝트 생성 및 실행
- 이유: VisionCamera와 MLKit은 Expo Go에서 지원되지 않음

3) 흐름 정리 (권장)
- 스캔 진입점이 두 곳으로 분산되어 있음
  - `ScanScreen.tsx`: `expo-image-picker` 카메라/갤러리 사용
  - `CameraScreen.tsx`: `react-native-vision-camera` 사용
- 유지보수성 및 일관성을 위해 한 가지 방식으로 통일 권장
  - MVP 단계에서는 ImagePicker 기반(갤러리/카메라)으로 우선 통일
  - 고성능이 필요하면 Dev Client 환경에서 VisionCamera로 전환

### 수정 후 예상 동작
- `ScanScreen.tsx`의 API 수정만으로는 "Images of undefined" TypeError는 해소됨
- 단, Expo Go를 계속 사용할 경우, OCR 처리 단계에서 MLKit 네이티브 모듈 관련 에러가 새로 발생할 가능성 큼
- Dev Client로 전환하면 카메라 촬영 및 OCR까지 정상적으로 진행 가능

### 체크리스트
- [ ] `ScanScreen.tsx`의 `mediaTypes`를 `ImagePicker.MediaTypeOptions.Images`로 변경했고 배열을 제거했는가
- [ ] Dev Client로 실행했는가 (Expo Go 아님)
- [ ] Android 권한(카메라/미디어 라이브러리)이 허용되었는가
- [ ] 갤러리 선택 → OCR → 결과 화면 네비게이션이 정상 동작하는가

### 참고
- 동일 프로젝트 내 `CameraScreen.tsx`는 올바른 ImagePicker 사용 예를 보여주므로 참조용으로 적합
- 이미 `expo-dev-client` 의존성이 추가되어 있어 Dev Client 전환이 비교적 용이


