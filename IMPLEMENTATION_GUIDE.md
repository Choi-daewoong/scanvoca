# 단어장 공유 및 OCR 필터링 기능 구현 완료 가이드

## ✅ 구현 완료된 기능

### 1. 단어장 Export/Import 기능
- ✅ 단어장을 JSON 파일로 내보내기
- ✅ JSON 파일에서 단어장 가져오기
- ✅ 네이티브 공유 다이얼로그 (카카오톡, 이메일 등)
- ✅ 데이터 검증 및 에러 처리
- ✅ 중복 이름 자동 처리

### 2. OCR 스마트 필터링 기능
- ✅ 외운 단어 자동 제외 (여러 단어장 고려)
- ✅ 학습 상태 배치 조회
- ✅ 기초 단어 제외 옵션
- ✅ 필터링 통계 로깅

### 3. UI 컴포넌트
- ✅ ShareWordbookButton - 공유 버튼
- ✅ ImportWordbookButton - 가져오기 버튼

---

## 📁 생성된 파일 목록

### 서비스 레이어
1. **`app/src/services/wordbookExportImport.ts`**
   - Export/Import 핵심 로직
   - 학습 상태 조회 함수
   - 공유 기능

2. **`app/src/services/ocrFiltering.ts`**
   - OCR 필터링 로직
   - 외운 단어 제외
   - 필터 옵션 처리

### UI 컴포넌트
3. **`app/src/components/common/ShareWordbookButton.tsx`**
   - 단어장 공유 버튼

4. **`app/src/components/common/ImportWordbookButton.tsx`**
   - 단어장 가져오기 버튼

---

## 🔧 화면에 통합하는 방법

### 1. WordbookDetailScreen에 공유 버튼 추가

**파일**: `app/src/screens/WordbookDetailScreen.tsx`

#### 방법 A: import문 추가
```typescript
import ShareWordbookButton from '../components/common/ShareWordbookButton';
```

#### 방법 B: 헤더에 버튼 추가
```tsx
// 헤더 또는 상단 액션 영역에 추가
<View style={styles.headerActions}>
  <ShareWordbookButton
    wordbookId={wordbookId}
    wordbookName={wordbookName}
  />
</View>
```

**예시 (헤더 우측에 추가)**:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
  <TouchableOpacity onPress={handleEdit}>
    <Text>✏️ 편집</Text>
  </TouchableOpacity>

  {/* ✨ 공유 버튼 추가 */}
  <ShareWordbookButton
    wordbookId={wordbookId}
    wordbookName={wordbookName}
  />
</View>
```

---

### 2. WordbookScreen에 Import 버튼 추가

**파일**: `app/src/screens/WordbookScreen.tsx`

#### 방법 A: import문 추가
```typescript
import ImportWordbookButton from '../components/common/ImportWordbookButton';
```

#### 방법 B: 상단 또는 FloatingActionButton 영역에 추가
```tsx
// 상단 액션 바에 추가
<View style={styles.actionBar}>
  <Button onPress={handleCreateWordbook} title="새 단어장" />
  <ImportWordbookButton />
</View>

// 또는 하단 플로팅 버튼으로 추가
<View style={styles.floatingButtons}>
  <FloatingActionButton onPress={handleCreateWordbook} icon="+" />
  <ImportWordbookButton />
</View>
```

---

### 3. OCR 필터링 적용 (CameraScreen)

**파일**: `app/src/screens/CameraScreen.tsx`

#### import문 추가
```typescript
import { processExtractedWordsWithFilter } from '../services/ocrFiltering';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

#### OCR 처리 로직 수정
```typescript
const handleScan = async () => {
  try {
    // 1. OCR 실행
    const ocrResult = await ocrService.scanText(imageUri);

    // 2. 필터 설정 불러오기
    const settingsJson = await AsyncStorage.getItem('ocr_filter_settings');
    const filterSettings = settingsJson ? JSON.parse(settingsJson) : {
      excludeMastered: true,  // 기본: 외운 단어 제외
      excludeBasic: false,
      minimumDifficulty: 1
    };

    // 3. 필터링 적용
    const { processedWords, excludedCount, excludedWords } =
      await processExtractedWordsWithFilter(
        ocrResult,
        ocrService.cleanWord.bind(ocrService),  // cleanWord 함수 전달
        filterSettings
      );

    // 4. 결과 화면으로 이동
    navigation.navigate('ScanResults', {
      detectedWords: processedWords,
      excludedCount,  // ✨ 제외된 단어 수
      excludedWords   // ✨ 제외된 단어 목록
    });

  } catch (error) {
    console.error('OCR 실패:', error);
    Alert.alert('오류', 'OCR 처리에 실패했습니다.');
  }
};
```

---

### 4. ScanResultsScreen에 제외 정보 표시

**파일**: `app/src/screens/ScanResultsScreen.tsx`

#### Props 타입 수정
```typescript
interface ScanResultsScreenProps {
  detectedWords: ProcessedWord[];
  excludedCount?: number;  // ✨ 추가
  excludedWords?: Array<{ word: string; reason: string }>;  // ✨ 추가
  onRescan: () => void;
}
```

#### UI에 제외 정보 표시
```tsx
{/* 제외된 단어 배너 */}
{excludedCount > 0 && (
  <View style={styles.excludedBanner}>
    <Text style={styles.excludedText}>
      ✅ 외운 단어 {excludedCount}개 제외됨
    </Text>
    <TouchableOpacity onPress={() => setShowExcludedDetail(!showExcludedDetail)}>
      <Text style={styles.detailLink}>자세히</Text>
    </TouchableOpacity>
  </View>
)}

{/* 제외된 단어 상세 */}
{showExcludedDetail && excludedWords && (
  <View style={styles.excludedDetail}>
    <Text style={styles.excludedTitle}>제외된 단어:</Text>
    {excludedWords.map(({ word, reason }) => (
      <Text key={word} style={styles.excludedItem}>
        • {word} ({reason})
      </Text>
    ))}
  </View>
)}
```

#### 스타일 추가
```typescript
const styles = StyleSheet.create({
  excludedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  excludedText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  detailLink: {
    fontSize: 14,
    color: '#1976D2',
    textDecorationLine: 'underline',
  },
  excludedDetail: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  excludedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#424242',
  },
  excludedItem: {
    fontSize: 13,
    color: '#616161',
    marginBottom: 4,
  },
});
```

---

### 5. SettingsScreen에 OCR 필터 설정 추가

**파일**: `app/src/screens/SettingsScreen.tsx`

#### import문 추가
```typescript
import { Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

#### State 추가
```typescript
const [excludeMastered, setExcludeMastered] = useState(true);
const [excludeBasic, setExcludeBasic] = useState(false);
```

#### 설정 불러오기
```typescript
useEffect(() => {
  const loadFilterSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem('ocr_filter_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        setExcludeMastered(settings.excludeMastered ?? true);
        setExcludeBasic(settings.excludeBasic ?? false);
      }
    } catch (error) {
      console.error('설정 불러오기 실패:', error);
    }
  };
  loadFilterSettings();
}, []);
```

#### 설정 저장 함수
```typescript
const saveFilterSettings = async (key: string, value: boolean) => {
  try {
    const currentSettings = {
      excludeMastered,
      excludeBasic,
      [key]: value
    };
    await AsyncStorage.setItem('ocr_filter_settings', JSON.stringify(currentSettings));
  } catch (error) {
    console.error('설정 저장 실패:', error);
  }
};
```

#### UI 추가
```tsx
{/* OCR 필터 설정 섹션 */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>📷 OCR 스캔 필터 설정</Text>

  {/* 외운 단어 제외 옵션 */}
  <View style={styles.settingRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.settingLabel}>외운 단어 자동 제외</Text>
      <Text style={styles.settingDescription}>
        이미 암기한 단어는 스캔 결과에서 제외합니다
      </Text>
    </View>
    <Switch
      value={excludeMastered}
      onValueChange={(value) => {
        setExcludeMastered(value);
        saveFilterSettings('excludeMastered', value);
      }}
      trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
      thumbColor={excludeMastered ? '#10B981' : '#9CA3AF'}
    />
  </View>

  {/* 기초 단어 제외 옵션 */}
  <View style={styles.settingRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.settingLabel}>기초 단어 제외</Text>
      <Text style={styles.settingDescription}>
        레벨 1 (a, the, is 등) 단어는 제외합니다
      </Text>
    </View>
    <Switch
      value={excludeBasic}
      onValueChange={(value) => {
        setExcludeBasic(value);
        saveFilterSettings('excludeBasic', value);
      }}
      trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
      thumbColor={excludeBasic ? '#10B981' : '#9CA3AF'}
    />
  </View>
</View>
```

#### 스타일 추가
```typescript
const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1F2937',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
```

---

## 🧪 테스트 방법

### 1. Export/Import 테스트
```bash
# 1. 단어장 생성 및 단어 추가
# 2. WordbookDetailScreen에서 공유 버튼 클릭
# 3. 카카오톡 또는 이메일로 전송
# 4. 다른 기기에서 파일 다운로드
# 5. WordbookScreen에서 가져오기 버튼 클릭
# 6. 파일 선택 → 단어장 복원 확인
```

### 2. OCR 필터링 테스트
```bash
# 1. SettingsScreen에서 "외운 단어 제외" 활성화
# 2. 일부 단어를 퀴즈에서 3번 이상 맞추기 (외운 상태로 만들기)
# 3. CameraScreen에서 텍스트 스캔
# 4. ScanResultsScreen에서 "외운 단어 N개 제외됨" 메시지 확인
# 5. 자세히 버튼 클릭 → 제외된 단어 목록 확인
```

---

## 📊 기능 요약

### 완성된 기능
| 기능 | 구현 파일 | 상태 |
|------|----------|------|
| Export 함수 | wordbookExportImport.ts | ✅ |
| Import 함수 | wordbookExportImport.ts | ✅ |
| 네이티브 공유 | wordbookExportImport.ts | ✅ |
| 학습 상태 조회 | wordbookExportImport.ts | ✅ |
| OCR 필터링 | ocrFiltering.ts | ✅ |
| 공유 버튼 UI | ShareWordbookButton.tsx | ✅ |
| Import 버튼 UI | ImportWordbookButton.tsx | ✅ |

### 통합 필요 항목
| 화면 | 작업 | 우선순위 |
|------|------|---------|
| WordbookDetailScreen | 공유 버튼 추가 | High |
| WordbookScreen | Import 버튼 추가 | High |
| CameraScreen | 필터링 로직 적용 | High |
| ScanResultsScreen | 제외 정보 표시 | Medium |
| SettingsScreen | 필터 설정 UI | Medium |

---

## 🎯 다음 단계

1. **화면 통합** (2-3시간)
   - WordbookDetailScreen에 공유 버튼 추가
   - WordbookScreen에 Import 버튼 추가
   - CameraScreen에 필터링 로직 적용
   - ScanResultsScreen에 제외 정보 표시
   - SettingsScreen에 필터 설정 UI 추가

2. **테스트** (1-2시간)
   - Export/Import 동작 확인
   - OCR 필터링 동작 확인
   - 다양한 시나리오 테스트

3. **문서화 및 배포** (1시간)
   - 사용자 가이드 작성
   - CLAUDE.md 업데이트
   - Dev Client 빌드 및 배포

---

## ⚠️ 주의사항

1. **타입 오류**: ProcessedWord 타입이 ScanResultsScreen과 일치하는지 확인
2. **Navigation**: react-navigation 타입 오류 해결 필요 (ImportWordbookButton)
3. **AsyncStorage**: 설정 키 충돌 방지 ('ocr_filter_settings' 키 사용)
4. **에러 처리**: 모든 async 함수에 try-catch 적용
5. **Dev Client**: expo-sharing, expo-document-picker는 Dev Client에서만 동작

---

## 💡 팁

- **빠른 통합**: 위의 코드를 복사/붙여넣기로 빠르게 통합 가능
- **스타일 커스터마이징**: 각 컴포넌트의 styles를 수정하여 디자인 조정
- **디버깅**: console.log가 많이 추가되어 있어 문제 추적 쉬움
- **확장성**: 모듈화되어 있어 향후 기능 추가 용이

---

**구현 완료**: 2025-10-29
**문서 작성**: Claude Code
