# Scan Voca 개인정보 처리방침

**최종 수정일: 2026년 6월 14일**

## 1. 개요

Scan Voca("본 서비스")는 웹 기반 영단어 학습 서비스로, 회원가입 후 단어장과 학습 기록을 클라우드에 저장하여 어떤 기기에서든 이용할 수 있도록 합니다. 본 서비스는 사용자의 개인정보를 중요하게 생각하며, 서비스 제공에 필요한 최소한의 정보만 수집·보관합니다.

## 2. 수집하는 정보

### 2.1 회원가입 시 수집하는 정보
- **이메일 주소**: 로그인 식별 및 비밀번호 재설정에 사용
- **비밀번호**: 해시(bcrypt)로 암호화하여 저장 (평문 저장 안 함)
- **표시 이름(닉네임)**
- **Google 로그인 이용 시**: Google 계정의 이메일, 이름 (Google이 발급한 ID 토큰을 서버에서 직접 검증)

### 2.2 서비스 이용 중 생성되는 정보
- **단어장 데이터**: 사용자가 생성한 단어장, 추가한 단어, 사용자 정의 뜻
- **학습 기록**: 퀴즈/시험/학습 모드 결과, 학습 통계
- **스캔 이미지**: OCR(이미지 속 영단어 인식)을 위해 서버로 전송되어 AI가 분석에만 사용하며, 분석 후 서버에 저장하지 않음

## 3. 정보의 사용 목적

수집된 정보는 다음 목적으로만 사용됩니다:
- 회원 식별 및 로그인/인증 (JWT 기반)
- 단어장·학습 기록의 저장 및 동기화
- 이미지 속 영단어 인식 (OCR)
- 단어 정의·예문·발음 정보 생성 (AI API 사용)
- 비밀번호 재설정 (이메일 OTP 발송)

## 4. 정보의 저장 및 보관

- 회원 정보, 단어장, 학습 기록은 **Supabase PostgreSQL 데이터베이스(서버)**에 저장됩니다.
- 비밀번호는 복호화가 불가능한 해시 형태로만 저장됩니다.
- 스캔한 이미지 파일 자체는 분석 처리 후 저장하지 않습니다.
- 단어 정의·예문 등 AI 생성 결과는 동일 단어의 재요청 시 비용 절감을 위해 서버 DB/캐시에 보관되며, 이 데이터에는 사용자 식별 정보가 포함되지 않습니다.

## 5. 제3자 서비스

### 5.1 AI API (Google AI)
- **사용 목적**: 단어 정의, 예문, 발음 정보 생성 및 이미지 속 영단어 인식(OCR)
- **전송 데이터**: 영단어 텍스트 또는 스캔 이미지 (사용자 식별 정보 미포함)
- **데이터 보관**: 제공사의 개인정보 처리방침에 따름

### 5.2 Google 로그인 (OAuth)
- **사용 목적**: 소셜 로그인을 통한 회원가입/인증
- **처리 방식**: Google이 발급한 ID 토큰을 서버에서 직접 검증, 이메일/이름 정보만 사용

### 5.3 Supabase
- **사용 목적**: 회원 정보 및 서비스 데이터 저장(PostgreSQL 호스팅)

### 5.4 Gmail SMTP
- **사용 목적**: 비밀번호 재설정 OTP 이메일 발송

### 5.5 Google Cloud Run / Vercel
- **사용 목적**: 백엔드 API 및 웹앱 호스팅

## 6. 권한 사용 (웹 브라우저)

### 6.1 카메라/사진 접근
- **사용 목적**: 텍스트 스캔을 위한 이미지 촬영 또는 선택
- **처리 방식**: 선택한 이미지는 OCR 분석을 위해 서버로 전송되며, 분석 후 저장하지 않음

## 7. 사용자 권리

- **데이터 조회/수정**: 단어장 및 단어 뜻은 서비스 내에서 직접 수정/삭제 가능
- **계정 및 데이터 삭제**: 회원 탈퇴 시 계정 정보 및 연관된 단어장·학습 기록 삭제
- **비밀번호 변경**: 이메일 OTP를 통한 비밀번호 재설정 가능

## 8. 아동 개인정보 보호

본 서비스는 주로 중/고등학생을 대상으로 하며, 만 14세 미만 아동의 회원가입 시 법정대리인의 동의가 필요할 수 있습니다. 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.

## 9. 개인정보 처리방침 변경

본 개인정보 처리방침은 법률 또는 서비스 변경에 따라 업데이트될 수 있으며, 중요한 변경 사항은 서비스 내 공지를 통해 알려드립니다.

## 10. 연락처

개인정보 처리방침과 관련한 문의사항은 아래로 연락주시기 바랍니다:

- **GitHub**: https://github.com/Choi-daewoong/scanvoca

---

**Scan Voca Privacy Policy (English)**

## 1. Overview

Scan Voca ("the Service") is a web-based vocabulary learning service. After signing up, users' wordbooks and study records are stored in the cloud so they can be accessed from any device. The Service collects only the minimum information necessary to provide its features.

## 2. Information We Collect

### 2.1 Collected at Sign-up
- **Email address**: used for login and password reset
- **Password**: stored as a bcrypt hash (never stored in plain text)
- **Display name**
- **Google Sign-In**: email and name from your Google account (ID token verified server-side)

### 2.2 Generated While Using the Service
- **Wordbook data**: wordbooks, words, and custom definitions you create
- **Study records**: quiz/exam/study mode results and statistics
- **Scanned images**: sent to the server for OCR/AI analysis only; not stored after processing

## 3. How We Use Information

- Account identification and authentication (JWT-based)
- Storing and syncing wordbooks and study records
- Recognizing English words in images (OCR)
- Generating word definitions, examples, and pronunciation via AI API
- Sending password reset OTP emails

## 4. Data Storage

- Account, wordbook, and study data are stored in a **Supabase PostgreSQL database** (server-side).
- Passwords are stored only as irreversible hashes.
- Scanned image files are not retained after analysis.
- AI-generated word definitions may be cached server-side (without user identifiers) to reduce API costs on repeated lookups.

## 5. Third-Party Services

- **Google AI API**: word definitions, examples, pronunciation, and OCR
- **Google Sign-In (OAuth)**: optional social login
- **Supabase**: database hosting
- **Gmail SMTP**: password reset OTP emails
- **Google Cloud Run / Vercel**: backend and web app hosting

## 6. Browser Permissions

- **Camera/Photo access**: used to capture or select images for OCR scanning; images are sent to the server for analysis and not stored afterward

## 7. User Rights

- View/edit/delete wordbooks and word definitions within the app
- Delete your account and associated data
- Reset your password via email OTP

## 8. Children's Privacy

This Service is primarily intended for middle and high school students. Users under 14 may require parental consent to register, in accordance with applicable law. We do not knowingly collect personal information from children under 14 without such consent.

## 9. Changes to Privacy Policy

This privacy policy may be updated due to legal or service changes. Significant changes will be announced within the Service.

## 10. Contact

- **GitHub**: https://github.com/Choi-daewoong/scanvoca

---

*Last Updated: June 14, 2026*
