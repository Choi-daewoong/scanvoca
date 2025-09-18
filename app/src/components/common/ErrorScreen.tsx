import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

interface ErrorScreenProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  onRetry?: () => void;
}

export default function ErrorScreen({
  title = '데이터베이스 초기화 실패',
  subtitle = '앱을 다시 시작해 주세요',
  buttonText = '다시 시도',
  onRetry
}: ErrorScreenProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing.lg,
    },
    emoji: {
      fontSize: 48,
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.h4,
      color: theme.colors.semantic.error,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    retryButton: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
    },
    retryButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>❌</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}