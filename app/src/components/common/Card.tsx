import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import theme from '../../styles/theme';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
}) => {
  const getCardStyle = (): ViewStyle[] => {
    const baseStyle = [styles.card];

    // Variant 스타일
    switch (variant) {
      case 'elevated':
        baseStyle.push(styles.elevated);
        break;
      case 'outlined':
        baseStyle.push(styles.outlined);
        break;
      default:
        baseStyle.push(styles.default);
    }

    // Padding 스타일
    switch (padding) {
      case 'none':
        // 패딩 없음
        break;
      case 'sm':
        baseStyle.push(styles.paddingSm);
        break;
      case 'lg':
        baseStyle.push(styles.paddingLg);
        break;
      default:
        baseStyle.push(styles.paddingMd);
    }

    if (style) {
      baseStyle.push(style);
    }

    return baseStyle;
  };

  return <View style={getCardStyle()}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.primary,
  },
  
  // Variant 스타일
  default: {
    ...theme.shadows.sm,
  },
  elevated: {
    ...theme.shadows.lg,
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Padding 스타일
  paddingSm: {
    padding: theme.spacing.sm,
  },
  paddingMd: {
    padding: theme.spacing.md,
  },
  paddingLg: {
    padding: theme.spacing.lg,
  },
});

export default Card;