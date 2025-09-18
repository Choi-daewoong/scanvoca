import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

export interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: any;
  labelStyle?: any;
  checkboxStyle?: any;
}

export default function Checkbox({
  checked,
  onPress,
  label,
  disabled = false,
  size = 'md',
  style,
  labelStyle,
  checkboxStyle,
}: CheckboxProps) {
  const { theme } = useTheme();

  const sizeConfig = {
    sm: {
      size: 16,
      borderRadius: 3,
      checkmarkSize: 10,
      labelSize: theme.typography.caption.fontSize,
    },
    md: {
      size: 20,
      borderRadius: 4,
      checkmarkSize: 12,
      labelSize: theme.typography.body2.fontSize,
    },
    lg: {
      size: 24,
      borderRadius: 5,
      checkmarkSize: 14,
      labelSize: theme.typography.body1.fontSize,
    },
  };

  const config = sizeConfig[size];

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      opacity: disabled ? 0.5 : 1,
    },
    checkbox: {
      width: config.size,
      height: config.size,
      borderRadius: config.borderRadius,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: label ? theme.spacing.sm : 0,
    },
    unchecked: {
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.primary,
    },
    checked: {
      borderColor: theme.colors.primary.main,
      backgroundColor: theme.colors.primary.main,
    },
    checkmark: {
      fontSize: config.checkmarkSize,
      color: theme.colors.primary.contrast,
      fontWeight: 'bold',
    },
    label: {
      fontSize: config.labelSize,
      color: theme.colors.text.primary,
      flex: 1,
    },
  });

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          checked ? styles.checked : styles.unchecked,
          checkboxStyle,
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
}