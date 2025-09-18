import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

export interface SectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: any;
  titleStyle?: any;
  contentStyle?: any;
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Section({
  title,
  subtitle,
  children,
  style,
  titleStyle,
  contentStyle,
  spacing = 'md',
}: SectionProps) {
  const { theme } = useTheme();

  const spacingMap = {
    none: 0,
    sm: theme.spacing.sm,
    md: theme.spacing.md,
    lg: theme.spacing.lg,
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: spacingMap[spacing],
    },
    titleContainer: {
      marginBottom: title || subtitle ? theme.spacing.sm : 0,
    },
    title: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      marginBottom: subtitle ? 2 : 0,
    },
    subtitle: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
    },
    content: {
      // Content styling can be customized via contentStyle prop
    },
  });

  return (
    <View style={[styles.container, style]}>
      {(title || subtitle) && (
        <View style={styles.titleContainer}>
          {title && <Text style={[styles.title, titleStyle]}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}