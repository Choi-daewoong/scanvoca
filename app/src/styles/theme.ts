// 디자인 시스템 - 테마 정의
export const theme = {
  // 색상 팔레트
  colors: {
    primary: {
      main: '#4F46E5',      // 인디고 (신뢰감, 학습)
      light: '#818CF8',     // 연한 인디고
      dark: '#3730A3',      // 진한 인디고
      contrast: '#FFFFFF',  // 대비색 (흰색)
    },
    secondary: {
      main: '#10B981',      // 에메랄드 (성공, 성취)
      light: '#6EE7B7',     // 연한 에메랄드
      dark: '#059669',      // 진한 에메랄드
      contrast: '#FFFFFF',  // 대비색 (흰색)
    },
    accent: {
      orange: '#F59E0B',    // 주황 (중요, 주의)
      red: '#EF4444',       // 빨강 (오답, 경고)
      yellow: '#FDE047',    // 노랑 (강조)
      blue: '#3B82F6',      // 파랑 (정보)
    },
    neutral: {
      white: '#FFFFFF',
      gray50: '#F9FAFB',
      gray100: '#F3F4F6',
      gray200: '#E5E7EB',
      gray300: '#D1D5DB',
      gray400: '#9CA3AF',
      gray500: '#6B7280',
      gray600: '#4B5563',
      gray700: '#374151',
      gray800: '#1F2937',
      gray900: '#111827',
      black: '#000000',
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F9FAFB',
      tertiary: '#F3F4F6',
    },
    text: {
      primary: '#111827',
      secondary: '#4B5563',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    border: {
      light: '#E5E7EB',
      medium: '#D1D5DB',
      dark: '#9CA3AF',
    }
  },

  // 타이포그래피
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: 'bold' as const,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      lineHeight: 32,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 26,
      letterSpacing: 0,
    },
    h5: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: 0,
    },
    h6: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    body1: {
      fontSize: 16,
      fontWeight: 'normal' as const,
      lineHeight: 24,
      letterSpacing: 0,
    },
    body2: {
      fontSize: 14,
      fontWeight: 'normal' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    caption: {
      fontSize: 12,
      fontWeight: 'normal' as const,
      lineHeight: 16,
      letterSpacing: 0.25,
    },
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: 0.25,
    },
    overline: {
      fontSize: 10,
      fontWeight: '600' as const,
      lineHeight: 12,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    }
  },

  // 간격 시스템
  spacing: {
    xs: 4,   // 0.25rem
    sm: 8,   // 0.5rem  
    md: 16,  // 1rem
    lg: 24,  // 1.5rem
    xl: 32,  // 2rem
    xxl: 48, // 3rem
    xxxl: 64, // 4rem
  },

  // 둥근 모서리
  borderRadius: {
    none: 0,
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },

  // 그림자
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 16,
    }
  },

  // 애니메이션
  animation: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      easeIn: 'ease-in',
      easeOut: 'ease-out', 
      easeInOut: 'ease-in-out',
      linear: 'linear',
    }
  },

  // 단어 관련 컴포넌트 (CLAUDE.md 기반)
  word: {
    // 단어 난이도 표시 (5단계)
    level: {
      1: {
        color: '#FCD34D',    // 노랑 - 기초
        stars: 1,
        label: '기초',
        backgroundColor: '#FEF3C7',
      },
      2: {
        color: '#60A5FA',    // 파랑 - 중급
        stars: 2,
        label: '중급',
        backgroundColor: '#DBEAFE',
      },
      3: {
        color: '#F97316',    // 주황 - 고급
        stars: 3,
        label: '고급',
        backgroundColor: '#FED7AA',
      },
      4: {
        color: '#EF4444',    // 빨강 - 최고급
        stars: 4,
        label: '최고급',
        backgroundColor: '#FECACA',
      },
      5: {
        color: '#9333EA',    // 보라 - 전문가
        stars: 5,
        label: '전문가',
        backgroundColor: '#F3E8FF',
      },
    },
    // 품사 태그 스타일
    partOfSpeech: {
      backgroundColor: '#4F46E5',
      color: '#FFFFFF',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      minWidth: 28,
      fontSize: 12,
      fontWeight: '600' as const,
    },
    // 발음 버튼 스타일
    pronunciationButton: {
      backgroundColor: 'transparent',
      padding: 8,
      borderRadius: 6,
      activeOpacity: 0.7,
    },
    // 사전 버튼 스타일
    dictionaryButton: {
      borderWidth: 1,
      borderColor: '#D1D5DB',
      backgroundColor: '#FFFFFF',
      padding: 8,
      borderRadius: 6,
      activeOpacity: 0.8,
    },
  },

  // 레이아웃
  layout: {
    headerHeight: 56,
    tabBarHeight: 60,
    fabSize: 56,
    buttonHeight: {
      sm: 32,
      md: 40,
      lg: 48,
      xl: 56,
    },
    iconSize: {
      xs: 12,
      sm: 16,
      md: 20,
      lg: 24,
      xl: 32,
    }
  },

  // 브레이크포인트 (반응형)
  breakpoints: {
    xs: 0,
    sm: 480,
    md: 768,
    lg: 1024,
    xl: 1280,
  }
};

// 테마 타입 정의
export type Theme = typeof theme;

// 다크 테마 (향후 확장용)
export const darkTheme: Theme = {
  ...theme,
  colors: {
    ...theme.colors,
    background: {
      primary: '#111827',
      secondary: '#1F2937',
      tertiary: '#374151',
    },
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#9CA3AF',
      inverse: '#111827',
    },
    border: {
      light: '#374151',
      medium: '#4B5563',
      dark: '#6B7280',
    }
  }
};

export default theme;