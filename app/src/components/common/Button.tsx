import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import theme from '../../styles/theme';

export interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
  children,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle = [styles.button, styles[size]];

    if (fullWidth) baseStyle.push(styles.fullWidth);
    if (variant === 'primary') baseStyle.push(styles.primary);
    if (variant === 'secondary') baseStyle.push(styles.secondary);
    if (variant === 'outline') baseStyle.push(styles.outline);
    if (variant === 'text') baseStyle.push(styles.text);
    if (disabled) baseStyle.push(styles.disabled);
    if (style) baseStyle.push(style);

    return StyleSheet.flatten(baseStyle);
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = [styles.buttonText, styles[`${size}Text` as keyof typeof styles]];

    if (variant === 'primary') baseStyle.push(styles.primaryText);
    if (variant === 'secondary') baseStyle.push(styles.secondaryText);
    if (variant === 'outline') baseStyle.push(styles.outlineText);
    if (variant === 'text') baseStyle.push(styles.textText);
    if (disabled) baseStyle.push(styles.disabledText);
    if (textStyle) baseStyle.push(textStyle);

    return StyleSheet.flatten(baseStyle);
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.primary.contrast : theme.colors.primary.main}
        />
      ) : (
        <>
          {children ? children : (
            <>
              {icon}
              <Text style={getTextStyle()}>{title}</Text>
            </>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.sm,
  },
  
  // 크기별 스타일
  sm: {
    height: theme.layout.buttonHeight.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  md: {
    height: theme.layout.buttonHeight.md,
    paddingHorizontal: theme.spacing.md,
  },
  lg: {
    height: theme.layout.buttonHeight.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  xl: {
    height: theme.layout.buttonHeight.xl,
    paddingHorizontal: theme.spacing.xl,
  },
  
  // 너비
  fullWidth: {
    width: '100%',
  },
  
  // 버튼 variant 스타일
  primary: {
    backgroundColor: theme.colors.primary.main,
  },
  secondary: {
    backgroundColor: theme.colors.secondary.main,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary.main,
  },
  text: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // 비활성화
  disabled: {
    backgroundColor: theme.colors.neutral.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // 텍스트 기본 스타일
  buttonText: {
    textAlign: 'center',
    fontWeight: theme.typography.button.fontWeight,
  },
  
  // 텍스트 크기별 스타일
  smText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mdText: {
    fontSize: theme.typography.button.fontSize,
    lineHeight: theme.typography.button.lineHeight,
  },
  lgText: {
    fontSize: 18,
    lineHeight: 26,
  },
  xlText: {
    fontSize: 20,
    lineHeight: 28,
  },
  
  // 텍스트 variant 스타일
  primaryText: {
    color: theme.colors.primary.contrast,
  },
  secondaryText: {
    color: theme.colors.secondary.contrast,
  },
  outlineText: {
    color: theme.colors.primary.main,
  },
  textText: {
    color: theme.colors.primary.main,
  },
  
  // 비활성화 텍스트
  disabledText: {
    color: theme.colors.neutral.gray500,
  },
});

export default Button;