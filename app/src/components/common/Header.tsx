import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  centered?: boolean;
}

export default function Header({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  centered = false,
}: HeaderProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background.primary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      minHeight: theme.layout.headerHeight,
    },
    leftSection: {
      flex: 1,
      alignItems: 'flex-start',
    },
    centerSection: {
      flex: 2,
      alignItems: centered ? 'center' : 'flex-start',
    },
    rightSection: {
      flex: 1,
      alignItems: 'flex-end',
    },
    titleContainer: {
      alignItems: centered ? 'center' : 'flex-start',
    },
    title: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
    },
    subtitle: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    iconButton: {
      padding: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {leftIcon && (
          <TouchableOpacity style={styles.iconButton} onPress={onLeftPress}>
            {leftIcon}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      <View style={styles.rightSection}>
        {rightIcon && (
          <TouchableOpacity style={styles.iconButton} onPress={onRightPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}