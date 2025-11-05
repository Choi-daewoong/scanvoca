# Scan Voca 배포 가이드

## 📋 배포 전 체크리스트

### ✅ 필수 준비물

- [ ] **EAS CLI 설치**: `npm install -g eas-cli`
- [ ] **Expo 계정**: https://expo.dev 가입
- [ ] **EAS 로그인**: `eas login`
- [ ] **앱 아이콘**: 1024x1024px PNG (icon.png, adaptive-icon.png)
- [ ] **스플래시 스크린**: splash-icon.png
- [ ] **개인정보 처리방침 URL**: 호스팅 완료
- [ ] **Google Play Console 계정** (Android 배포용)
- [ ] **Apple Developer 계정** (iOS 배포용, $99/년)

---

## 🚀 1단계: 아이콘 준비

### 아이콘 생성
1. `app/assets/icon-design.svg` 파일을 https://svgtopng.com/ 에 업로드
2. 1024x1024px로 변환
3. 다음 파일들로 저장:
   - `app/assets/icon.png` (1024x1024)
   - `app/assets/adaptive-icon.png` (1024x1024, Android용)
   - `app/assets/favicon.png` (48x48, 웹용)

### 스플래시 스크린
- `app/assets/splash-icon.png` (간단한 로고만, 배경은 흰색)

---

## 🔧 2단계: 빌드 전 설정 확인

### app.json 확인
```bash
cd app
cat app.json
```

확인 사항:
- `name`: "Scan Voca"
- `version`: "1.0.0"
- `bundleIdentifier` (iOS): com.scanvoca.app
- `package` (Android): com.twostwo.scanvoca
- `icon`, `splash` 경로 확인

### TypeScript 에러 확인
```bash
cd app
npm run typecheck
npm run lint
```

---

## 📱 3단계: Android 배포

### 3.1 프로덕션 빌드 (AAB)

```bash
cd app
eas build --platform android --profile production
```

**빌드 옵션**:
- **App Bundle (AAB)**: Google Play Store 제출용
- 빌드 시간: 약 10-20분
- 다운로드 링크: EAS 대시보드에서 확인

### 3.2 Google Play Console 설정

1. **Google Play Console** 접속: https://play.google.com/console
2. **새 앱 만들기** 클릭
3. **앱 정보 입력**:
   - 앱 이름: Scan Voca - 스마트 영단어 학습
   - 기본 언어: 한국어
   - 앱 또는 게임: 앱
   - 무료 또는 유료: 무료

4. **스토어 등록정보 작성**:
   - 짧은 설명 (80자): `STORE_LISTING.md` 참조
   - 전체 설명 (4000자): `STORE_LISTING.md` 참조
   - 스크린샷 업로드 (최소 2개, 권장 6-8개)
   - 피처 그래픽 업로드 (1024x500px)

5. **앱 액세스**:
   - "모든 기능을 제한 없이 사용할 수 있습니다" 선택

6. **개인정보 보호정책**:
   - URL 입력: [개인정보 처리방침 호스팅 URL]

7. **앱 카테고리**:
   - 카테고리: 교육
   - 태그: 교육용 앱

8. **콘텐츠 등급**:
   - 설문지 작성 (일반적으로 "Everyone" 등급)

9. **타겟 고객 및 콘텐츠**:
   - 타겟 연령: 전체 이용가
   - 광고 포함 여부: 아니요 (Phase 1)

10. **앱 릴리스**:
    - 프로덕션 트랙 선택
    - AAB 파일 업로드 (EAS에서 다운로드한 파일)
    - 릴리스 노트 작성: `STORE_LISTING.md` 참조

11. **검토 제출**:
    - 모든 항목 완료 후 "검토용으로 제출" 클릭
    - 승인까지 1-3일 소요

### 3.3 내부 테스트 (선택사항)

프로덕션 전에 내부 테스트를 권장합니다:

```bash
cd app
eas build --platform android --profile preview
```

- 내부 테스트 트랙에 업로드하여 팀원들과 테스트

---

## 🍎 4단계: iOS 배포

### 4.1 Apple Developer 계정 필요
- 연간 $99 (₩130,000)
- 가입: https://developer.apple.com/

### 4.2 프로덕션 빌드 (IPA)

```bash
cd app
eas build --platform ios --profile production
```

**Apple 인증서 설정**:
- EAS가 자동으로 처리 (권장)
- 또는 수동으로 인증서 생성 후 업로드

### 4.3 App Store Connect 설정

1. **App Store Connect** 접속: https://appstoreconnect.apple.com/
2. **새 앱 추가**:
   - 플랫폼: iOS
   - 이름: Scan Voca
   - 기본 언어: 한국어
   - 번들 ID: com.scanvoca.app (app.json과 일치해야 함)
   - SKU: com.scanvoca.app (고유 식별자)

3. **앱 정보 입력**:
   - 카테고리: 교육
   - 부카테고리: 언어 학습 (선택사항)

4. **가격 및 배포**:
   - 가격: 무료
   - 배포 국가: 전 세계 또는 선택

5. **앱 개인정보 보호**:
   - 개인정보 처리방침 URL: [URL]
   - 데이터 수집 항목: "없음" (Phase 1)

6. **스크린샷 및 미리보기**:
   - iPhone 13 Pro Max (1284x2778)
   - 최소 1개, 권장 3-5개

7. **앱 설명**:
   - 프로모션 텍스트: `STORE_LISTING.md` 참조
   - 설명: `STORE_LISTING.md` 참조
   - 키워드: `STORE_LISTING.md` 참조
   - 지원 URL: [GitHub 또는 웹사이트 URL]
   - 마케팅 URL: [선택사항]

8. **빌드 업로드**:
   - EAS에서 다운로드한 IPA 파일
   - TestFlight을 통해 업로드 (자동)

9. **앱 검토**:
   - 검토용 계정 정보 (필요 시)
   - 검토 노트 작성
   - "검토 제출" 클릭
   - 승인까지 1-3일 소요

---

## 🧪 5단계: 테스트 배포 (권장)

### 내부 테스트용 빌드

#### Android (APK)
```bash
cd app
eas build --platform android --profile preview
```

#### iOS (TestFlight)
```bash
cd app
eas build --platform ios --profile preview
```

### 테스트 방법
1. EAS 대시보드에서 빌드 다운로드
2. 테스트 기기에 설치
3. 주요 기능 테스트:
   - 카메라 스캔
   - 단어 추가
   - 단어장 생성/관리
   - 퀴즈 실행
   - 설정 변경

---

## 🔄 6단계: 업데이트 배포

### 버전 업데이트

1. **app.json 수정**:
```json
{
  "expo": {
    "version": "1.0.1",
    "ios": {
      "buildNumber": "2"
    },
    "android": {
      "versionCode": 2
    }
  }
}
```

2. **빌드 및 배포**:
```bash
cd app
eas build --platform all --profile production
```

3. **스토어 업데이트**:
   - Google Play: 새 AAB 업로드
   - App Store: 새 IPA 업로드
   - 릴리스 노트 작성

---

## 📊 7단계: 배포 후 모니터링

### Google Play Console
- **통계**: 다운로드, 활성 사용자, 평점
- **비정상 종료**: 크래시 리포트 확인
- **평가 및 리뷰**: 사용자 피드백 확인

### App Store Connect
- **앱 분석**: 설치, 사용자, 수익
- **크래시**: Xcode Organizer에서 확인
- **평가 및 리뷰**: 사용자 피드백 확인

### Expo Analytics (선택사항)
```bash
npx expo install expo-analytics
```

---

## 🛠️ 유용한 명령어

### EAS 빌드 상태 확인
```bash
eas build:list
```

### 특정 빌드 상세 정보
```bash
eas build:view [BUILD_ID]
```

### 빌드 취소
```bash
eas build:cancel [BUILD_ID]
```

### EAS 설정 확인
```bash
eas config
```

### 자격증명 관리
```bash
eas credentials
```

---

## 🚨 문제 해결

### 빌드 실패 시
1. **에러 로그 확인**: EAS 대시보드에서 상세 로그 확인
2. **TypeScript 에러**: `npm run typecheck` 실행
3. **의존성 문제**: `npm install` 재실행
4. **네이티브 모듈**: `npx expo prebuild --clean` 후 재빌드

### 스토어 거부 시
- **개인정보 처리방침**: URL 접근 가능한지 확인
- **스크린샷**: 앱 기능과 일치하는지 확인
- **설명**: 과장되지 않은 정확한 설명
- **권한**: 사용하는 권한에 대한 명확한 설명

---

## 📚 참고 자료

- **EAS Build 문서**: https://docs.expo.dev/build/introduction/
- **Google Play Console 가이드**: https://support.google.com/googleplay/android-developer
- **App Store Connect 가이드**: https://developer.apple.com/app-store-connect/
- **Expo Application Services**: https://expo.dev/eas

---

## 📝 체크리스트 요약

배포 전 최종 확인:

- [ ] 아이콘 및 스플래시 스크린 준비 완료
- [ ] app.json 메타데이터 확인
- [ ] TypeScript 및 Lint 에러 없음
- [ ] 개인정보 처리방침 호스팅 완료
- [ ] 스토어 설명문 준비 완료
- [ ] 스크린샷 6-8개 준비 완료
- [ ] 테스트 빌드로 주요 기능 테스트 완료
- [ ] 프로덕션 빌드 성공
- [ ] 스토어 제출 완료

---

**배포 성공을 기원합니다! 🎉**
