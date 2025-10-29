# 빠른 통합 가이드 - 코드 스니펫

## 1. WordbookDetailScreen.tsx 수정

### Step 1: import문 추가 (line 18 다음에 추가)
```typescript
import ShareWordbookButton from '../components/common/ShareWordbookButton';
```

### Step 2: 헤더에 공유 버튼 추가 (line 1010-1015 수정)
기존 코드:
```typescript
<TouchableOpacity
  style={styles.editBtn}
  onPress={() => setIsEditingTitle(true)}
>
  <Text style={styles.editBtnText}>편집</Text>
</TouchableOpacity>
```

수정 후:
```typescript
<View style={{ flexDirection: 'row', gap: 8 }}>
  <TouchableOpacity
    style={styles.editBtn}
    onPress={() => setIsEditingTitle(true)}
  >
    <Text style={styles.editBtnText}>편집</Text>
  </TouchableOpacity>

  <ShareWordbookButton
    wordbookId={wordbookId}
    wordbookName={editedTitle}
  />
</View>
```

---

## 2. WordbookScreen.tsx 수정

### Step 1: import문 추가
```typescript
import ImportWordbookButton from '../components/common/ImportWordbookButton';
```

### Step 2: 화면 상단에 Import 버튼 추가
플로팅 액션 버튼 영역이나 헤더에 추가:
```typescript
{/* 상단 액션 바 - Import 버튼 추가 */}
<View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
  <Text style={{ fontSize: 20, fontWeight: 'bold' }}>내 단어장</Text>
  <ImportWordbookButton />
</View>
```

---

## 3. CameraScreen.tsx 수정

### Step 1: import문 추가
```typescript
import { processExtractedWordsWithFilter } from '../services/ocrFiltering';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

### Step 2: OCR 처리 함수 수정
기존 `handleScan` 함수를 찾아서 다음으로 교체:

```typescript
const handleScan = async () => {
  try {
    setIsProcessing(true);

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
        (text: string) => ocrService.cleanWord(text),  // cleanWord 함수 전달
        filterSettings
      );

    // 4. 결과 화면으로 이동
    navigation.navigate('ScanResults', {
      detectedWords: processedWords,
      excludedCount,  // 제외된 단어 수
      excludedWords   // 제외된 단어 목록
    });

  } catch (error) {
    console.error('OCR 실패:', error);
    Alert.alert('오류', 'OCR 처리에 실패했습니다.');
  } finally {
    setIsProcessing(false);
  }
};
```

---

## 4. ScanResultsScreen.tsx 수정

### Step 1: Props 인터페이스 수정
```typescript
interface ScanResultsScreenProps {
  route: {
    params: {
      detectedWords: ProcessedWord[];
      excludedCount?: number;  // 추가
      excludedWords?: Array<{ word: string; reason: string }>;  // 추가
    };
  };
  navigation: any;
}
```

### Step 2: State 추가
```typescript
const [showExcludedDetail, setShowExcludedDetail] = useState(false);
const { detectedWords, excludedCount, excludedWords } = route.params;
```

### Step 3: UI에 제외 정보 배너 추가 (스캔 결과 상단에)
```typescript
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

### Step 4: 스타일 추가
```typescript
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
```

---

## 5. SettingsScreen.tsx 수정

### Step 1: import 추가
```typescript
import { Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

### Step 2: State 추가
```typescript
const [excludeMastered, setExcludeMastered] = useState(true);
const [excludeBasic, setExcludeBasic] = useState(false);
```

### Step 3: 설정 불러오기 useEffect 추가
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

### Step 4: 설정 저장 함수 추가
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

### Step 5: UI 섹션 추가 (설정 화면에)
```typescript
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

### Step 6: 스타일 추가
```typescript
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
```

---

## ✅ 완료 체크리스트

- [ ] WordbookDetailScreen.tsx - ShareWordbookButton 추가
- [ ] WordbookScreen.tsx - ImportWordbookButton 추가
- [ ] CameraScreen.tsx - OCR 필터링 로직 적용
- [ ] ScanResultsScreen.tsx - 제외 정보 표시 추가
- [ ] SettingsScreen.tsx - OCR 필터 설정 UI 추가
- [ ] 타입 체크 실행: `cd app && npm run typecheck`
- [ ] 앱 실행 및 테스트

---

## 🔥 빠른 시작

1. 위 코드를 해당 파일에 복사/붙여넣기
2. 타입 오류 확인: `cd app && npm run typecheck`
3. Dev Client 재시작: `cd app && npx expo start --dev-client --clear`
4. 기능 테스트

---

**작성일**: 2025-10-29
**문서**: QUICK_INTEGRATION.md
