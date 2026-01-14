# Google 로그인 설정 가이드

구글 로그인 기능을 사용하기 위해서는 Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 발급받아야 합니다.

## 1. Google Cloud Console 프로젝트 생성

### 1-1. Google Cloud Console 접속
- https://console.cloud.google.com/ 접속
- Google 계정으로 로그인

### 1-2. 새 프로젝트 생성
1. 상단 프로젝트 선택 드롭다운 클릭
2. "새 프로젝트" 클릭
3. 프로젝트 이름: `Scan Voca` (또는 원하는 이름)
4. "만들기" 클릭

## 2. OAuth 동의 화면 구성

### 2-1. OAuth 동의 화면 설정
1. 왼쪽 메뉴에서 "API 및 서비스" → "OAuth 동의 화면" 선택
2. User Type: **"외부"** 선택 후 "만들기" 클릭

### 2-2. 앱 정보 입력
- **앱 이름**: `Scan Voca`
- **사용자 지원 이메일**: 본인 이메일 주소
- **앱 로고**: (선택사항)
- **앱 도메인**: (선택사항 - 웹사이트가 있는 경우)
- **개발자 연락처 정보**: 본인 이메일 주소

### 2-3. 범위 설정
1. "범위 추가 또는 삭제" 클릭
2. 다음 범위 선택:
   - `userinfo.email` (이메일 주소 보기)
   - `userinfo.profile` (개인정보 보기)
   - `openid`
3. "업데이트" 클릭

### 2-4. 테스트 사용자 추가 (개발 단계)
1. "테스트 사용자" 섹션에서 "사용자 추가" 클릭
2. 테스트에 사용할 Google 계정 이메일 추가
3. "저장 후 계속" 클릭

## 3. OAuth 2.0 클라이언트 ID 생성

### 3-1. 사용자 인증 정보 만들기
1. 왼쪽 메뉴에서 "API 및 서비스" → "사용자 인증 정보" 선택
2. 상단의 "+ 사용자 인증 정보 만들기" 클릭
3. "OAuth 클라이언트 ID" 선택

### 3-2. Android 클라이언트 ID 생성
1. **애플리케이션 유형**: Android
2. **이름**: `Scan Voca Android`
3. **패키지 이름**: `com.scanvoca.app` (또는 app.json의 package 값)
4. **SHA-1 인증서 디지털 지문**:
   ```bash
   # Debug 키스토어 SHA-1 가져오기 (개발용)
   cd android/app
   keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
   # 비밀번호: android

   # Release 키스토어 SHA-1 가져오기 (배포용)
   keytool -keystore my-release-key.keystore -list -v
   ```
5. SHA-1 값 복사하여 입력
6. "만들기" 클릭

### 3-3. iOS 클라이언트 ID 생성
1. **애플리케이션 유형**: iOS
2. **이름**: `Scan Voca iOS`
3. **번들 ID**: `com.scanvoca.app` (또는 app.json의 bundleIdentifier 값)
4. "만들기" 클릭

### 3-4. 웹 클라이언트 ID 생성 ⭐ (중요!)
1. **애플리케이션 유형**: 웹 애플리케이션
2. **이름**: `Scan Voca Web`
3. **승인된 자바스크립트 원본**: (비워둠)
4. **승인된 리디렉션 URI**: (비워둠)
5. "만들기" 클릭
6. **⭐ 생성된 클라이언트 ID를 복사** - 이것이 `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`에 사용됩니다!

## 4. 환경 변수 설정

### 4-1. `.env` 파일 생성
`app/.env` 파일을 생성하고 다음 내용 입력:

```env
# Google OAuth 클라이언트 ID (웹 클라이언트 ID 사용!)
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
```

### 4-2. 클라이언트 ID 복사하기
Google Cloud Console의 "사용자 인증 정보" 페이지에서:
1. 생성한 각 클라이언트 ID 우측의 "다운로드" 아이콘 클릭
2. JSON 파일에서 `client_id` 값 복사
3. `.env` 파일에 해당하는 변수에 붙여넣기

**⚠️ 중요**:
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`에는 **웹 애플리케이션** 클라이언트 ID를 사용해야 합니다.
- Android/iOS 클라이언트 ID가 아닌 **웹 클라이언트 ID**를 사용하세요!

## 5. Google Sign-In 라이브러리 설정 확인

### 5-1. 패키지 설치 확인
```bash
cd app
npm install @react-native-google-signin/google-signin
```

### 5-2. Android 설정 확인
`app/android/app/build.gradle`에 다음이 포함되어 있는지 확인:
```gradle
dependencies {
    implementation(project(':react-native-google-signin_google-signin'))
}
```

### 5-3. iOS 설정 확인
```bash
cd app/ios
pod install
```

## 6. 테스트

### 6-1. 앱 실행
```bash
cd app
npx expo start --dev-client --clear
```

### 6-2. Google 로그인 테스트
1. LoginScreen에서 "Google로 계속하기" 버튼 클릭
2. Google 계정 선택 화면 표시
3. 계정 선택 후 권한 승인
4. 로그인 성공 → 홈 화면으로 이동

### 6-3. 오류 해결

#### "개발자에게 문의하세요" 오류
- OAuth 동의 화면의 테스트 사용자에 본인 계정이 추가되었는지 확인
- 앱이 "테스트" 모드인 경우 테스트 사용자만 로그인 가능

#### "10: Developer Error" 오류
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`가 **웹 클라이언트 ID**인지 확인
- SHA-1 인증서가 올바르게 등록되었는지 확인
- 패키지 이름 / Bundle ID가 일치하는지 확인

#### "SIGN_IN_CANCELLED" 오류
- 사용자가 로그인을 취소한 경우 (정상 동작)

#### "PLAY_SERVICES_NOT_AVAILABLE" 오류
- Android 기기에 Google Play Services가 설치되지 않음
- 에뮬레이터의 경우 Google Play가 포함된 이미지 사용

## 7. 프로덕션 배포 시 추가 설정

### 7-1. OAuth 동의 화면 게시
1. Google Cloud Console → "OAuth 동의 화면"
2. "앱 게시" 버튼 클릭
3. 검토 제출 (Google의 검토 승인 필요)

### 7-2. Release 키스토어 SHA-1 추가
1. Release 빌드용 키스토어의 SHA-1 가져오기
2. Android 클라이언트 ID에 SHA-1 추가
3. 앱 재빌드 및 배포

## 8. 참고 자료

- [Google Sign-In for React Native](https://github.com/react-native-google-signin/google-signin)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 가이드](https://developers.google.com/identity/protocols/oauth2)
- [Expo Google Authentication](https://docs.expo.dev/guides/google-authentication/)

## 문제 해결 체크리스트

- [ ] Google Cloud Console에서 프로젝트 생성됨
- [ ] OAuth 동의 화면 구성 완료
- [ ] 웹, Android, iOS 클라이언트 ID 모두 생성됨
- [ ] `.env` 파일에 클라이언트 ID 설정됨
- [ ] **웹 클라이언트 ID**를 `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`에 사용
- [ ] SHA-1 인증서 등록됨 (Android)
- [ ] Bundle ID 일치 확인 (iOS)
- [ ] 테스트 사용자 추가됨
- [ ] Dev Client 빌드로 테스트 중
- [ ] Google Play Services 설치됨 (Android)

---

**작성일**: 2026-01-14
**버전**: 1.0
