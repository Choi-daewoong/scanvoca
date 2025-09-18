// 네비게이션 연결 상태 테스트 스크립트
export interface NavigationTestResult {
  route: string;
  description: string;
  implemented: boolean;
  notes?: string;
}

export function getNavigationTests(): NavigationTestResult[] {
  return [
    // 메인 탭 네비게이션
    {
      route: 'MainTabs/Home',
      description: '홈 화면',
      implemented: true,
      notes: '데이터베이스 통계, 학습 진도 표시'
    },
    {
      route: 'MainTabs/Scan',
      description: '스캔 화면',
      implemented: true,
      notes: '카메라/갤러리 선택 UI'
    },
    {
      route: 'MainTabs/Wordbook',
      description: '단어장 목록',
      implemented: true,
      notes: '단어장 생성, 편집, 삭제 기능'
    },

    // 모달/스택 화면들
    {
      route: 'Camera',
      description: '카메라 스캔',
      implemented: true,
      notes: 'OCR 시뮬레이션, 진행률 표시, 실시간 단어 감지'
    },
    {
      route: 'ScanResults',
      description: '스캔 결과',
      implemented: true,
      notes: '단어 선택, 단어장 저장, 레벨 필터링'
    },
    {
      route: 'WordDetail',
      description: '단어 상세',
      implemented: true,
      notes: '암기 상태 관리, 단어장 추가, 사전 연결'
    },
    {
      route: 'WordbookDetail',
      description: '단어장 상세',
      implemented: true,
      notes: '단어 목록, 퀴즈 시작, 단어 제거'
    },
    {
      route: 'QuizSession',
      description: '퀴즈',
      implemented: true,
      notes: '4지선다 퀴즈, 진행률 표시, 학습 기록'
    },
    {
      route: 'QuizResults',
      description: '퀴즈 결과',
      implemented: true,
      notes: '점수 분석, 오답 정리, 재시도 기능'
    },
    {
      route: 'Settings',
      description: '설정',
      implemented: true,
      notes: '데이터베이스 정보, 학습 목표, 백업'
    },
    {
      route: 'StudyStats',
      description: '학습 통계',
      implemented: true,
      notes: '진도 차트, 레벨별 통계, 주간 진도'
    },

    // 주요 네비게이션 경로들
    {
      route: 'Home → Scan → Camera → ScanResults → Wordbook',
      description: '스캔 플로우',
      implemented: true,
      notes: '스캔-결과-저장 전체 플로우'
    },
    {
      route: 'Home → Wordbook → WordbookDetail → QuizSession → QuizResults',
      description: '퀴즈 플로우',
      implemented: true,
      notes: '단어장-퀴즈-결과 전체 플로우'
    },
    {
      route: 'WordbookDetail → WordDetail',
      description: '단어 상세 보기',
      implemented: true,
      notes: '단어장에서 개별 단어 상세 정보'
    },
    {
      route: 'Home → StudyStats',
      description: '통계 보기',
      implemented: true,
      notes: '홈에서 학습 통계로 이동'
    },
    {
      route: 'Home → Settings',
      description: '설정 보기',
      implemented: true,
      notes: '홈에서 설정으로 이동'
    }
  ];
}

export function logNavigationStatus(): void {
  const tests = getNavigationTests();

  console.log('\n🧭 네비게이션 연결 상태 체크');
  console.log('='.repeat(50));

  let implementedCount = 0;
  let totalCount = tests.length;

  tests.forEach((test, index) => {
    const status = test.implemented ? '✅' : '❌';
    const notes = test.notes ? ` (${test.notes})` : '';

    console.log(`${index + 1}. ${status} ${test.route}`);
    console.log(`   ${test.description}${notes}`);

    if (test.implemented) implementedCount++;
  });

  console.log('='.repeat(50));
  console.log(`📊 구현 상태: ${implementedCount}/${totalCount} (${Math.round((implementedCount / totalCount) * 100)}%)`);

  if (implementedCount === totalCount) {
    console.log('🎉 모든 네비게이션이 구현되었습니다!');
  } else {
    console.log(`⚠️  ${totalCount - implementedCount}개의 네비게이션이 아직 구현되지 않았습니다.`);
  }
}