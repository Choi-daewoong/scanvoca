# Scan Voca 개인정보 처리방침

**최종 수정일: 2025년 11월 5일**

## 1. 개요

Scan Voca("본 앱")는 사용자의 개인정보를 중요하게 생각하며, 최소한의 정보만 수집하고 안전하게 관리합니다.

## 2. 수집하는 정보

### 2.1 자동으로 수집되는 정보
- **없음**: 본 앱은 사용자 동의 없이 자동으로 수집하는 정보가 없습니다.

### 2.2 사용자가 제공하는 정보
- **카메라 이미지**: 텍스트 스캔을 위해 촬영한 이미지 (로컬 처리만, 서버 전송 안 함)
- **단어장 데이터**: 사용자가 저장한 단어 및 학습 기록 (기기 내부에만 저장)
- **학습 설정**: 앱 사용 환경 설정 (기기 내부에만 저장)

## 3. 정보의 사용 목적

수집된 정보는 다음 목적으로만 사용됩니다:
- 영단어 스캔 및 인식 (OCR)
- 단어 정의 제공 (OpenAI GPT API 사용)
- 학습 진도 추적
- 퀴즈 및 복습 기능 제공

## 4. 정보의 저장 및 보관

### 4.1 로컬 저장
- **모든 데이터는 사용자 기기에만 저장**됩니다.
- AsyncStorage를 사용하여 로컬에 암호화되지 않은 형태로 저장됩니다.
- 앱 삭제 시 모든 데이터가 함께 삭제됩니다.

### 4.2 서버 저장
- **현재 Phase 1에서는 서버에 데이터를 전송하거나 저장하지 않습니다.**
- 향후 업데이트에서 클라우드 백업 기능 추가 시 별도 동의를 받을 예정입니다.

## 5. 제3자 서비스

### 5.1 OpenAI GPT API
- **사용 목적**: 단어 정의, 예문, 발음 정보 생성
- **전송 데이터**: 영단어 텍스트만 전송 (개인정보 미포함)
- **개인정보 보호**: 사용자 식별 정보는 전송하지 않음
- **데이터 보관**: OpenAI의 개인정보 처리방침에 따름

### 5.2 Expo 서비스
- **사용 목적**: 앱 업데이트 및 배포
- **전송 데이터**: 앱 사용 통계 (익명)
- **개인정보 보호**: 개인 식별 정보는 수집하지 않음

## 6. 권한 사용

### 6.1 카메라 권한
- **사용 목적**: 텍스트 스캔을 위한 사진 촬영
- **처리 방식**: 촬영된 이미지는 기기 내부에서만 처리되며 서버로 전송되지 않음

### 6.2 저장소 권한
- **사용 목적**: 갤러리에서 이미지 선택
- **처리 방식**: 선택된 이미지는 텍스트 인식 후 저장하지 않음

## 7. 사용자 권리

사용자는 다음 권리를 가집니다:
- **데이터 삭제**: 앱 내 설정에서 모든 단어장 및 학습 기록 삭제 가능
- **앱 삭제**: 앱 삭제 시 모든 데이터가 자동으로 삭제됨
- **권한 철회**: 기기 설정에서 카메라, 저장소 권한 철회 가능

## 8. 개인정보 보호

- 본 앱은 **회원가입 없이** 사용 가능합니다.
- **로그인 정보를 수집하지 않습니다.**
- **이메일, 전화번호 등 개인 식별 정보를 요구하지 않습니다.**

## 9. 아동 개인정보 보호

본 앱은 만 13세 이상 사용자를 대상으로 하며, 만 13세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.

## 10. 개인정보 처리방침 변경

본 개인정보 처리방침은 법률 또는 서비스 변경에 따라 업데이트될 수 있습니다. 중요한 변경 사항은 앱 내 공지를 통해 알려드립니다.

## 11. 연락처

개인정보 처리방침과 관련한 문의사항은 아래로 연락주시기 바랍니다:

- **이메일**: [이메일 주소 입력]
- **GitHub**: https://github.com/[사용자명]/scan-voca

---

**Scan Voca Privacy Policy (English)**

## 1. Overview

Scan Voca ("the App") respects user privacy and collects minimal information.

## 2. Information We Collect

### 2.1 Automatically Collected
- **None**: No automatic data collection without user consent.

### 2.2 User-Provided Information
- **Camera Images**: For text scanning (processed locally, not uploaded)
- **Vocabulary Data**: Saved words and study progress (stored locally only)
- **App Settings**: User preferences (stored locally only)

## 3. How We Use Information

- Text scanning and recognition (OCR)
- Word definitions via OpenAI GPT API
- Study progress tracking
- Quiz and review features

## 4. Data Storage

### 4.1 Local Storage
- **All data is stored on your device only**
- Stored using AsyncStorage (unencrypted)
- Deleted when you uninstall the app

### 4.2 Server Storage
- **Phase 1: No server storage**
- Future cloud backup will require separate consent

## 5. Third-Party Services

### 5.1 OpenAI GPT API
- **Purpose**: Generate word definitions and examples
- **Data Sent**: English words only (no personal information)
- **Privacy**: No user identification data sent

### 5.2 Expo Services
- **Purpose**: App updates and distribution
- **Data Sent**: Anonymous usage statistics
- **Privacy**: No personal identification data collected

## 6. Permissions

### 6.1 Camera Permission
- **Purpose**: Capture photos for text scanning
- **Processing**: Images processed locally, not uploaded

### 6.2 Storage Permission
- **Purpose**: Select images from gallery
- **Processing**: Selected images not stored after text recognition

## 7. User Rights

You have the right to:
- **Delete Data**: Remove all vocabulary and study records in app settings
- **Uninstall App**: All data automatically deleted
- **Revoke Permissions**: Withdraw camera/storage permissions in device settings

## 8. Privacy Protection

- **No account registration required**
- **No login information collected**
- **No personal identification data requested** (email, phone, etc.)

## 9. Children's Privacy

This app is intended for users aged 13 and above. We do not knowingly collect information from children under 13.

## 10. Changes to Privacy Policy

This privacy policy may be updated due to legal or service changes. Significant changes will be announced within the app.

## 11. Contact

For privacy policy inquiries:
- **Email**: [Insert email address]
- **GitHub**: https://github.com/[username]/scan-voca

---

*Last Updated: November 5, 2025*
