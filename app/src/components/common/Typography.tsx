import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import theme from '../../styles/theme';

export interface TypographyProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body1' | 'body2' | 'caption' | 'button' | 'overline';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'success' | 'warning' | 'error' | 'info';
  align?: 'left' | 'center' | 'right';
  weight?: 'normal' | 'medium' | 'bold';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}

const Typography: React.FC<TypographyProps> = ({
  children,
  variant = 'body1',
  color = 'primary',
  align = 'left',
  weight,
  style,
  numberOfLines,
  onPress,
}) => {
  const getTextStyle = (): StyleProp<TextStyle> => {
    const baseStyle: any[] = [styles.text, styles[variant]];

    // 색상 적용
    switch (color) {
      case 'primary':
        baseStyle.push(styles.colorPrimary);
        break;
      case 'secondary':
        baseStyle.push(styles.colorSecondary);
        break;
      case 'tertiary':
        baseStyle.push(styles.colorTertiary);
        break;
      case 'inverse':
        baseStyle.push(styles.colorInverse);
        break;
      case 'success':
        baseStyle.push(styles.colorSuccess);
        break;
      case 'warning':
        baseStyle.push(styles.colorWarning);
        break;
      case 'error':
        baseStyle.push(styles.colorError);
        break;
      case 'info':
        baseStyle.push(styles.colorInfo);
        break;
    }

    // 정렬 적용
    switch (align) {
      case 'center':
        baseStyle.push(styles.alignCenter);
        break;
      case 'right':
        baseStyle.push(styles.alignRight);
        break;
      default:
        baseStyle.push(styles.alignLeft);
    }

    // 폰트 굵기 오버라이드
    if (weight) {
      baseStyle.push({ fontWeight: weight });
    }

    if (style) {
      baseStyle.push(style);
    }

    return baseStyle;
  };

  return (
    <Text
      style={getTextStyle()}
      numberOfLines={numberOfLines}
      onPress={onPress}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    includeFontPadding: false,
  },
  
  // Typography variants
  h1: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    lineHeight: theme.typography.h1.lineHeight,
    letterSpacing: theme.typography.h1.letterSpacing,
  },
  h2: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    lineHeight: theme.typography.h2.lineHeight,
    letterSpacing: theme.typography.h2.letterSpacing,
  },
  h3: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    lineHeight: theme.typography.h3.lineHeight,
    letterSpacing: theme.typography.h3.letterSpacing,
  },
  h4: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    lineHeight: theme.typography.h4.lineHeight,
    letterSpacing: theme.typography.h4.letterSpacing,
  },
  body1: {
    fontSize: theme.typography.body1.fontSize,
    fontWeight: theme.typography.body1.fontWeight,
    lineHeight: theme.typography.body1.lineHeight,
    letterSpacing: theme.typography.body1.letterSpacing,
  },
  body2: {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: theme.typography.body2.fontWeight,
    lineHeight: theme.typography.body2.lineHeight,
    letterSpacing: theme.typography.body2.letterSpacing,
  },
  caption: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.typography.caption.fontWeight,
    lineHeight: theme.typography.caption.lineHeight,
    letterSpacing: theme.typography.caption.letterSpacing,
  },
  button: {
    fontSize: theme.typography.button.fontSize,
    fontWeight: theme.typography.button.fontWeight,
    lineHeight: theme.typography.button.lineHeight,
    letterSpacing: theme.typography.button.letterSpacing,
  },
  overline: {
    fontSize: theme.typography.overline.fontSize,
    fontWeight: theme.typography.overline.fontWeight,
    lineHeight: theme.typography.overline.lineHeight,
    letterSpacing: theme.typography.overline.letterSpacing,
    textTransform: theme.typography.overline.textTransform,
  },
  
  // Colors
  colorPrimary: {
    color: theme.colors.text.primary,
  } as TextStyle,
  colorSecondary: {
    color: theme.colors.text.secondary,
  } as TextStyle,
  colorTertiary: {
    color: theme.colors.text.tertiary,
  } as TextStyle,
  colorInverse: {
    color: theme.colors.text.inverse,
  } as TextStyle,
  colorSuccess: {
    color: theme.colors.semantic.success,
  } as TextStyle,
  colorWarning: {
    color: theme.colors.semantic.warning,
  } as TextStyle,
  colorError: {
    color: theme.colors.semantic.error,
  } as TextStyle,
  colorInfo: {
    color: theme.colors.semantic.info,
  } as TextStyle,
  
  // Alignment
  alignLeft: {
    textAlign: 'left',
  } as TextStyle,
  alignCenter: {
    textAlign: 'center',
  } as TextStyle,
  alignRight: {
    textAlign: 'right',
  } as TextStyle,
});

export default Typography;